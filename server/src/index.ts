import Express from "express";

const PORT = process.env.PORT

const app = Express()

console.log(`Server is working at http://localhost:${PORT}`);