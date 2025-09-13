const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());


let tasks = [];
let nextId = 1;


const mongoose = require('mongoose');
const useMongo = !!process.env.MONGODB_URI;
let TaskModel = null;

if (useMongo) {
  mongoose
    .connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || undefined
    })
    .then(() => {

      console.log('Connected to MongoDB');
    })
    .catch((err) => {

      console.error('MongoDB connection error:', err.message);
      process.exit(1);
    });

  const taskSchema = new mongoose.Schema(
    {
      title: { type: String, required: true },
      description: { type: String, default: '' },
      completed: { type: Boolean, default: false },
      status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' }
    },
    { timestamps: true }
  );

  TaskModel = mongoose.model('Task', taskSchema);
}


app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Task Manager API' });
});

app.post('/tasks', async (req, res) => {
  try {
    const { title, description = '', completed = false, status = 'pending' } = req.body || {};
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required and must be a string' });
    }
    const validStatuses = ['pending', 'in-progress', 'completed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "status must be one of 'pending' | 'in-progress' | 'completed'" });
    }

    if (useMongo) {
      const created = await TaskModel.create({ title, description, completed, status });
      return res.status(201).json(created);
    }

    const task = { id: nextId++, title, description, completed, status };
    tasks.push(task);
    return res.status(201).json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

app.get('/tasks', async (req, res) => {
  try {
    const { q, status } = req.query || {};
    const validStatuses = ['pending', 'in-progress', 'completed'];
    const statusFilter = status && validStatuses.includes(String(status)) ? String(status) : undefined;

    if (useMongo) {
      const mongoFilter = {};
      if (statusFilter) mongoFilter.status = statusFilter;
      if (q && typeof q === 'string' && q.trim().length > 0) {
        const regex = new RegExp(q.trim(), 'i');
        mongoFilter.$or = [{ title: regex }, { description: regex }];
      }
      const all = await TaskModel.find(mongoFilter).sort({ createdAt: -1 });
      return res.json(all);
    }

    let result = tasks.slice();
    if (statusFilter) {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (q && typeof q === 'string' && q.trim().length > 0) {
      const needle = q.trim().toLowerCase();
      result = result.filter(
        (t) => (t.title && t.title.toLowerCase().includes(needle)) || (t.description && t.description.toLowerCase().includes(needle))
      );
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

app.get('/tasks/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (useMongo) {
      const doc = await TaskModel.findById(id);
      if (!doc) return res.status(404).json({ error: 'Task not found' });
      return res.json(doc);
    }
    const numericId = Number(id);
    const task = tasks.find((t) => t.id === numericId);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    return res.json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch task' });
  }
});

app.put('/tasks/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { title, description, completed, status } = req.body || {};
    const validStatuses = ['pending', 'in-progress', 'completed'];
    if (status !== undefined && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "status must be one of 'pending' | 'in-progress' | 'completed'" });
    }

    if (useMongo) {
      const updated = await TaskModel.findByIdAndUpdate(
        id,
        { $set: { title, description, completed, status } },
        { new: true, runValidators: true }
      );
      if (!updated) return res.status(404).json({ error: 'Task not found' });
      return res.json(updated);
    }

    const numericId = Number(id);
    const index = tasks.findIndex((t) => t.id === numericId);
    if (index === -1) return res.status(404).json({ error: 'Task not found' });

    const existing = tasks[index];
    const updated = {
      ...existing,
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(completed !== undefined ? { completed } : {}),
      ...(status !== undefined ? { status } : {})
    };
    tasks[index] = updated;
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (useMongo) {
      const deleted = await TaskModel.findByIdAndDelete(id);
      if (!deleted) return res.status(404).json({ error: 'Task not found' });
      return res.json({ success: true });
    }
    const numericId = Number(id);
    const prevLen = tasks.length;
    tasks = tasks.filter((t) => t.id !== numericId);
    if (tasks.length === prevLen) return res.status(404).json({ error: 'Task not found' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Task Manager API listening on port ${PORT}`);
});

module.exports = app;
