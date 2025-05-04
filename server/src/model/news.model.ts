import { model, Schema } from "mongoose";

const newsSchema = new Schema({
    title: { type: String, required: [true, "Please enter title"] },
    description: { type: String, required: [true, "Please enter description"] },
    thumbnail: { type: String },
    files: [{ type: String, url: String }],
    category: { type: String, enum: ["Sensitive", "Emergency", "Solution", "Unknown"] },
    sub_category: { type: String, enum: ["Verified", "Potential Flagged", "Trending", "Unknown"] },
    Labels: [{ type: String }],
    score: { type: Number },
    score_reasoning: [{ type: String }],
    insights: String
}, { timestamps: true })

export const News = model("News", newsSchema);