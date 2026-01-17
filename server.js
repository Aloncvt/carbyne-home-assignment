import express from 'express';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});

export default { app, server };