import express from "express"
import cors from "cors"

const app=express()
app.use(express.json())
app.use(cors())
app.use(express.static("uploads"))
app.get("/",(req,res)=>{
    return res.send("Content Pipeline API")
})
app.listen(3000,()=>{
    console.log("Server Started at http://localhost:3000")
}) 




