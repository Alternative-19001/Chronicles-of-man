const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect('mongodb+srv://mahad:mahidnadeem2009@cluster0.yuy0n.mongodb.net/test', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Comment Schema
const commentSchema = new mongoose.Schema({
    parent: { type: mongoose.Schema.Types.Mixed, default: 0 },
    content: String,
    createdAt: String,
    score: Number,
    user: {
        username: String,
        image: { png: String }
    }
});

const Comment = mongoose.model('Comment', commentSchema);

// API Routes
app.get('/api/comments', async (req, res) => {
    try {
        const comments = await Comment.find();
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

app.post('/api/comments', async (req, res) => {
    try {
        const savedComment = await new Comment(req.body).save();
        res.status(201).json(savedComment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

app.put('/api/comments/:id', async (req, res) => {
    try {
        const updatedComment = await Comment.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updatedComment) return res.status(404).json({ error: 'Comment not found' });
        res.json(updatedComment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

app.delete('/api/comments/:id', async (req, res) => {
    try {
        const deletedComment = await Comment.findByIdAndDelete(req.params.id);
        if (!deletedComment) return res.status(404).json({ error: 'Comment not found' });
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

app.put('/api/comments/:id/vote', async (req, res) => {
    try {
        const { type } = req.body;
        console.log('Vote request:', { id: req.params.id, type }); // Debug log

        const comment = await Comment.findById(req.params.id);
        console.log('Found comment:', comment); // Debug log
        
        if (!comment) {
            console.log('Comment not found'); // Debug log
            return res.status(404).json({ error: 'Comment not found' });
        }

        comment.score = (comment.score || 0) + (type === 'up' ? 1 : -1);
        await comment.save();
        
        console.log('Updated comment:', comment); // Debug log
        res.json(comment);
    } catch (error) {
        console.error('Vote error:', error); // Debug log
        res.status(500).json({ error: 'Failed to update vote', message: error.message });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
