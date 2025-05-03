import { model, Schema } from "mongoose";

const newsSchema = new Schema({
    title: { type: String, required: [true, "Please enter title"] },
    description: { type: String, required: [true, "Please enter description"] },
    thumbnail: { type: String },
    files: [{ type: String, url: String }]
}, { timestamps: true })

export const News = model("News", newsSchema);