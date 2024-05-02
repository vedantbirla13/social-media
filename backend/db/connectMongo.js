import mongoose from "mongoose";

export const connectDB = async() => {
    try {
        const { connection } = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB connected to: ${connection.host}` )
    } catch (error) {
        console.log(`Error connecting to database: ${error.message}`)
        process.exit(1)
    }
}