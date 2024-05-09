const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173", "*"],
  credentials: true,
};

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};
//localhost:5000 and localhost:5173 are treated as same site.  so sameSite value must be strict in development server.  in production sameSite will be none
// in development server secure will false .  in production secure will be true

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = process.env.MONGO_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});



const logger = (req, res, next) => {
  console.log('log: info', req.method, req.url);
  next();
}


// token verify
const verifyToken = (req, res, next) => {
  const token = req?.cookies.token;
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}
const blogsCollection = client.db("myBlog").collection("blogs");
const commentsCollection = client.db("myBlog").collection("comments");

async function run() {
  try {

    app.get("/blogs", async (req, res) => {
      const cursor = blogsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.post("/blogs", async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    })


    app.patch("/blogs/:id",logger, verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedBlog = req.body;
      const result = await blogsCollection.updateOne(filter, {
        $set: updatedBlog,
      });
      res.send(result);
    })

    app.delete("/blogs/:id", logger, verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.deleteOne(query);
      res.send(result);
    })



    // comment api
app.post("/comments", logger, verifyToken, async (req, res) => {
  try {
    const { blogId, userName, email, userProfilePicture, commentText } = req.body;
    const comment = {
      blogId,
      email,
      userName,
      userProfilePicture,
      commentText,
    };
    const result = await commentsCollection.insertOne(comment);
    res.send(result);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).send({ message: "Error adding comment" });
  }
});

app.patch("/comments/:id", logger, verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const filter = { _id: new ObjectId(id) };
    const updatedComment = req.body;
    const result = await commentsCollection.updateOne(filter, {
      $set: updatedComment,
    });
    res.send(result);
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).send({ message: "Error updating comment" });
  }
})

app.get("/blogs/:id/comments", async (req, res) => {
  try {
    const blogId = req.params.id;
    const comments = await commentsCollection.find({ blogId }).toArray();
    res.send(comments);
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).send({ message: "Error fetching comments" });
  }
});



    // token code
    //creating Token
    app.post("/jwt", logger, verifyToken, async (req, res) => {
      const user = req.body;
      console.log("user for token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET);

      res.cookie("token", token, cookieOptions).send({ success: true });
    });

    //clearing Token
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });
    // await client.connect();
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
