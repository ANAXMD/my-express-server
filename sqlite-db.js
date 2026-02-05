// sqlite-db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

class SQLiteDB {
    constructor() {
        this.db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'));
        this.initDatabase();
    }

    async initDatabase() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Users table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        role TEXT DEFAULT 'user',
                        isActive BOOLEAN DEFAULT 1,
                        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        lastLogin DATETIME
                    )
                `, (err) => {
                    if (err) reject(err);
                });

                // Todos table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS todos (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        task TEXT NOT NULL,
                        description TEXT,
                        completed BOOLEAN DEFAULT 0,
                        priority TEXT DEFAULT 'medium',
                        dueDate DATETIME,
                        userId INTEGER NOT NULL,
                        tags TEXT,
                        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
                    )
                `, (err) => {
                    if (err) reject(err);
                });

                // Create indexes
                this.db.run('CREATE INDEX IF NOT EXISTS idx_todos_user ON todos(userId)');
                this.db.run('CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed)');
                this.db.run('CREATE INDEX IF NOT EXISTS idx_todos_priority ON todos(priority)');
                
                console.log('✅ SQLite database initialized');
                resolve();
            });
        });
    }

    // ======================
    // USER METHODS
    // ======================

    async createUser(userData) {
        return new Promise((resolve, reject) => {
            const { name, email, password, role = 'user' } = userData;
            this.db.run(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [name, email, password, role],
                function(err) {
                    if (err) {
                        // Handle duplicate email
                        if (err.message.includes('UNIQUE constraint failed')) {
                            reject(new Error('User with this email already exists.'));
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve({ 
                            id: this.lastID, 
                            name, 
                            email, 
                            role, 
                            isActive: true,
                            createdAt: new Date()
                        });
                    }
                }
            );
        });
    }

    async findUserByEmail(email) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM users WHERE email = ? AND isActive = 1',
                [email],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async findUserById(id) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT id, name, email, role, isActive, createdAt, lastLogin FROM users WHERE id = ? AND isActive = 1',
                [id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
    }

    async updateUserLastLogin(userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?',
                [userId],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    async updateUserName(userId, name) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'UPDATE users SET name = ? WHERE id = ?',
                [name, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }

    // ======================
    // TODO METHODS
    // ======================

    async createTodo(todoData) {
        return new Promise((resolve, reject) => {
            const { task, description, priority, dueDate, userId, tags } = todoData;
            this.db.run(
                `INSERT INTO todos (task, description, priority, dueDate, userId, tags) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    task, 
                    description || null, 
                    priority || 'medium', 
                    dueDate || null, 
                    userId, 
                    tags ? JSON.stringify(tags) : null
                ],
                function(err) {
                    if (err) reject(err);
                    else {
                        resolve({ 
                            id: this.lastID, 
                            ...todoData,
                            completed: false,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                    }
                }
            );
        });
    }

    async getTodosByUser(userId, filters = {}) {
        return new Promise((resolve, reject) => {
            const { page = 1, limit = 10, completed, priority, sortBy = 'createdAt', sortOrder = 'DESC', search } = filters;
            const offset = (page - 1) * limit;
            
            let query = 'SELECT * FROM todos WHERE userId = ?';
            const params = [userId];
            
            // Apply filters
            if (completed !== undefined) {
                query += ' AND completed = ?';
                params.push(completed === 'true' ? 1 : 0);
            }
            if (priority) {
                query += ' AND priority = ?';
                params.push(priority);
            }
            if (search) {
                query += ' AND task LIKE ?';
                params.push(`%${search}%`);
            }
            
            // Add sorting
            const validSortColumns = ['createdAt', 'dueDate', 'priority', 'task'];
            const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'createdAt';
            query += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;
            
            // Add pagination
            query += ' LIMIT ? OFFSET ?';
            params.push(limit, offset);
            
            this.db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else {
                    // Parse tags from JSON
                    const todos = rows.map(todo => ({
                        ...todo,
                        tags: todo.tags ? JSON.parse(todo.tags) : [],
                        completed: Boolean(todo.completed)
                    }));
                    resolve(todos);
                }
            });
        });
    }

    async getTodoById(id, userId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM todos WHERE id = ? AND userId = ?',
                [id, userId],
                (err, row) => {
                    if (err) reject(err);
                    else if (row) {
                        // Parse tags from JSON
                        row.tags = row.tags ? JSON.parse(row.tags) : [];
                        row.completed = Boolean(row.completed);
                        resolve(row);
                    } else {
                        resolve(null);
                    }
                }
            );
        });
    }

    async updateTodo(id, userId, updates) {
        return new Promise((resolve, reject) => {
            const { task, description, completed, priority, dueDate, tags } = updates;
            const fields = [];
            const values = [];
            
            if (task !== undefined) {
                fields.push('task = ?');
                values.push(task);
            }
            if (description !== undefined) {
                fields.push('description = ?');
                values.push(description);
            }
            if (completed !== undefined) {
                fields.push('completed = ?');
                values.push(completed ? 1 : 0);
            }
            if (priority !== undefined) {
                fields.push('priority = ?');
                values.push(priority);
            }
            if (dueDate !== undefined) {
                fields.push('dueDate = ?');
                values.push(dueDate);
            }
            if (tags !== undefined) {
                fields.push('tags = ?');
                values.push(JSON.stringify(tags));
            }
            
            fields.push('updatedAt = CURRENT_TIMESTAMP');
            
            if (fields.length === 0) {
                resolve(null);
                return;
            }
            
            const query = `UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND userId = ?`;
            values.push(id, userId);
            
            this.db.run(query, values, function(err) {
                if (err) reject(err);
                else if (this.changes === 0) {
                    resolve(null);
                } else {
                    this.db.get(
                        'SELECT * FROM todos WHERE id = ?',
                        [id],
                        (err, row) => {
                            if (err) reject(err);
                            else if (row) {
                                row.tags = row.tags ? JSON.parse(row.tags) : [];
                                row.completed = Boolean(row.completed);
                                resolve(row);
                            } else {
                                resolve(null);
                            }
                        }
                    );
                }
            });
        });
    }

    async deleteTodo(id, userId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM todos WHERE id = ? AND userId = ?',
                [id, userId],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes > 0);
                }
            );
        });
    }

    async getTodoStats(userId) {
        return new Promise((resolve, reject) => {
            const queries = [
                'SELECT COUNT(*) as total FROM todos WHERE userId = ?',
                'SELECT COUNT(*) as completed FROM todos WHERE userId = ? AND completed = 1',
                'SELECT COUNT(*) as pending FROM todos WHERE userId = ? AND completed = 0',
                'SELECT COUNT(*) as highPriority FROM todos WHERE userId = ? AND priority = "high"',
                'SELECT COUNT(*) as mediumPriority FROM todos WHERE userId = ? AND priority = "medium"',
                'SELECT COUNT(*) as lowPriority FROM todos WHERE userId = ? AND priority = "low"'
            ];
            
            Promise.all(
                queries.map(query => 
                    new Promise((res, rej) => {
                        this.db.get(query, [userId], (err, row) => {
                            if (err) rej(err);
                            else res(Object.values(row)[0]);
                        });
                    })
                )
            ).then(results => {
                resolve({
                    total: results[0],
                    completed: results[1],
                    pending: results[2],
                    highPriority: results[3],
                    mediumPriority: results[4],
                    lowPriority: results[5]
                });
            }).catch(reject);
        });
    }

    async getAllUsers() {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT id, name, email, role, isActive, createdAt, lastLogin FROM users ORDER BY createdAt DESC',
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async getAllTodos() {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT t.*, u.name as userName, u.email as userEmail 
                 FROM todos t 
                 LEFT JOIN users u ON t.userId = u.id 
                 ORDER BY t.createdAt DESC`,
                [],
                (err, rows) => {
                    if (err) reject(err);
                    else {
                        const todos = rows.map(todo => ({
                            ...todo,
                            tags: todo.tags ? JSON.parse(todo.tags) : [],
                            completed: Boolean(todo.completed),
                            user: {
                                name: todo.userName,
                                email: todo.userEmail
                            }
                        }));
                        resolve(todos);
                    }
                }
            );
        });
    }

    // Close database connection
    close() {
        this.db.close();
    }
}

// Singleton instance
let instance = null;

module.exports = {
    getInstance: () => {
        if (!instance) {
            instance = new SQLiteDB();
        }
        return instance;
    }
};
