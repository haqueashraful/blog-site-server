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



app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = process.env.MONGO_URI;

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
      try {
        let query = {};
        const search = req.query.search;
        const category = req.query.category;
    
        if (search) {
          query.title = { $regex: new RegExp(search, 'i') };
        }
    
        if (category) {
          query.category = category;
        }
    
        const cursor = blogsCollection.find(query);
        const result = await cursor.toArray();
    
        res.send(result);
      } catch (error) {
        console.error("Error fetching blogs:", error);
        res.status(500).send({ message: "Error fetching blogs" });
      }
    });
    
    
    

    app.post("/blogs", async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    })


    app.get("/blogs/:queryType/:queryValue", logger, verifyToken, async (req, res) => {
      try{
        const { queryType, queryValue } = req.params;
        let query;
        if (queryType === "id") {
          query = { _id: new ObjectId(queryValue) };
          const result = await blogsCollection.findOne(query); 
          return res.json(result); 
        } else if (queryType === "email") {
          query = { userEmail: queryValue };
          const result = await blogsCollection.find(query).toArray();
          res.json(result);
        }else {
          return res.status(400).json({ error: "Invalid query type" });
        }
      } catch (error) {
        console.error("Error fetching art & craft items:", error);
        res.status(500).json({ error: "Internal server error" });
      }
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
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    };
    //localhost:5000 and localhost:5173 are treated as same site.  so sameSite value must be strict in development server.  in production sameSite will be none
    // in development server secure will false .  in production secure will be true
  //creating Token
  app.post("/jwt", async (req, res) => {
    try {
      // Extract email from request body
      const { email } = req.body;
      console.log("User for token:", email);
      
      // Generate JWT token
      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
  
      // Set the cookie with the token
      res.cookie("token", token, cookieOptions);
  
      // Send the token in the response along with any other relevant data
      res.json({ token, message: "successfully" });
    } catch (error) {
      console.error("Error creating JWT:", error);
      // Send an appropriate error response
      res.status(500).json({ message: "Error creating JWT" });
    }
  });
  

    //clearing Token
    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("logging out", user);
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });
  
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
