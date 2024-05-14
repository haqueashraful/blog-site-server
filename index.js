const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "*",
    "https://assignment-eleven-ha.netlify.app",
  ],
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
  next();
};

// token verify
const verifyToken = (req, res, next) => {
  const token = req?.cookies.token;
  console.log(token)
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) =>{
    if(err){
        return res.status(401).send({message: 'unauthorized access'})
    }
    req.user = decoded;
    next();
})
};
const blogsCollection = client.db("myBlog").collection("blogs");
const commentsCollection = client.db("myBlog").collection("comments");
const wishListCollection = client.db("myBlog").collection("wishlist");

async function run() {
  try {
    app.get("/blogs", async (req, res) => {
      try {
        let query = {};
        const search = req.query.search;
        const category = req.query.category;
        const sortByRecent = req.query.recent === "true";

        if (search) {
          query.title = { $regex: new RegExp(search, "i") };
        }

        if (category) {
          query.category = category;
        }

        const cursor = blogsCollection.find(query);

        if (sortByRecent) {
          cursor.sort({ createdTime: -1 });
        }

        if (sortByRecent) {
          cursor.limit(6);
        }

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
    });

    app.get("/blogs/:queryType/:queryValue", async (req, res) => {
      try {
        const { queryType, queryValue } = req.params;
        let query;
        if (queryType === "id") {
          query = { _id: new ObjectId(queryValue) };
          const result = await blogsCollection.findOne(query);
          return res.send(result);
        } else if (queryType === "email") {
          query = { userEmail: queryValue };
          const result = await blogsCollection.find(query).toArray();
          res.send(result);
        } else {
          return res.status(400).json({ error: "Invalid query type" });
        }
      } catch (error) {
        console.error("Error fetching art & craft items:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Patch route for updating a blog entry
    app.patch("/blogs/:id",  async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updatedBlog = req.body;
        console.log(updatedBlog)
        const result = await blogsCollection.updateOne(filter, {
          $set: updatedBlog,
        });
        res.send(result);
      } catch (error) {
        console.error("Error updating blog:", error);
        res.status(500).json({ message: "Error updating blog" });
      }
    });

    // Delete route for deleting a blog entry
    app.delete("/blogs/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await blogsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error deleting blog:", error);
        res.status(500).json({ message: "Error deleting blog" });
      }
    });

    // comment api
    app.post("/comments", async (req, res) => {
      try {
        const { blogId, userName, userEmail, userPhoto, commentText } =
          req.body;
        const commentData = {
          blogId,
          commentText,
          userName,
          userPhoto,
          userEmail,
        };
        const result = await commentsCollection.insertOne(commentData);
        res.send(result);
      } catch (error) {
        console.error("Error adding comment:", error);
        res.status(500).send({ message: "Error adding comment" });
      }
    });

    app.patch("/comments/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const { commentText } = req.body;
        const update = { $set: { commentText: commentText } };
        const result = await commentsCollection.updateOne(filter, update);
        res.send(result);
      } catch (error) {
        console.error("Error updating comment:", error);
        res.status(500).send({ message: "Error updating comment" });
      }
    });

    app.get("/comments/:id", async (req, res) => {
      try {
        const blogId = req.params.id;
        const comments = await commentsCollection.find({ blogId }).toArray();
        res.send(comments);
      } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).send({ message: "Error fetching comments" });
      }
    });

    app.delete("/comments/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await commentsCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).send({ message: "Error deleting comment" });
      }
    });

    // feature api

    app.get("/featured-blogs", async (req, res) => {
      try {
        const blogs = await blogsCollection.find({}).toArray();

        const featuredBlogs = blogs
          .map((blog, index) => ({
            ...blog,
            wordCount: blog.long_description
              ? blog.long_description.split(" ").length
              : 0,
            serialNumber: index + 1,
          }))
          .sort((a, b) => b.wordCount - a.wordCount)
          .slice(0, 10);

        const formattedFeaturedBlogs = featuredBlogs.map((blog) => ({
          _id: blog._id,
          title: blog.title,
          userName: blog.userName,
          userPhoto: blog.userPhoto,
        }));

        res.json(formattedFeaturedBlogs);
      } catch (error) {
        console.error("Error fetching featured blogs:", error);
        res.status(500).json({ message: "Error fetching featured blogs" });
      }
    });

    // wishlist api
    app.get("/wishlist/:email", async (req, res) => {
      try {
        const query = { userEmail: req.params.email };
        const wishlist = await wishListCollection.find(query).toArray();
        res.send(wishlist);
      } catch (error) {
        console.error("Error fetching wishlist:", error);
        res.status(500).json({ message: "Error fetching wishlist" });
      }
    });
    app.post("/wishlist", async (req, res) => {
      const wishlist = req.body;
      const result = await wishListCollection.insertOne(wishlist);
      res.send(result);
    });
    app.delete("/wishlist/:id", async (req, res) => {
      try {
        const id = req.params.id;
        console.log(id);
        // Convert the string ID to a MongoDB ObjectId
        const query = { _id: id};
        const result = await wishListCollection.deleteOne(query);
    
        if (result.deletedCount === 1) {
          res.status(200).json({ message: "Item successfully deleted from wishlist" });
        } else {
          res.status(404).json({ message: "Item not found in wishlist" });
        }
      } catch (error) {
        console.error("Error deleting item from wishlist:", error);
        res.status(500).json({ message: "Error deleting item from wishlist" });
      }
    });
    // token code
    //creating Token
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    };

    app.post("/jwt", logger, async (req, res) => {
      try {
        const  email  = req.body;
        const token = jwt.sign( email , process.env.ACCESS_TOKEN_SECRET);

        res
        .cookie("token", token, cookieOptions)
        .send({ token, message: "successfully" })
      } catch (error) {
        console.error("Error creating JWT:", error);
        res.status(500).json({ message: "Error creating JWT" });
      }
    });

    //clearing Token
    app.post("/logout", async (req, res) => {
      const user = req.body;
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

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
