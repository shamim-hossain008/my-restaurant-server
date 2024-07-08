const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5001;

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7nyeh0h.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("restaurantDB").collection("users");
    const menuCollection = client.db("restaurantDB").collection("menu");
    const reviewCollection = client.db("restaurantDB").collection("reviews");
    const cartCollection = client.db("restaurantDB").collection("carts");
    const paymentCollection = client.db("restaurantDB").collection("payments");

    //jwt related api

    //Create token
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares for verify token
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }

      const token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.decoded.email;
        const query = { email: email };
        const user = await userCollection.findOne(query);
        const isAdmin = user?.role === "admin";
        if (!isAdmin) {
          return res.status(403).send({ message: "forbidden access" });
        }
      } catch (error) {
        console.log(error.message);
      }
      next();
    };

    // Users related api

    // get users data
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // get user data for admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;
        if (email !== req.decoded.email) {
          return res.status(403).send({ massage: "forbidden access" });
        }

        const query = { email: email };
        const user = await userCollection.findOne(query);
        let admin = false;
        if (user) {
          admin = user?.role === "admin";
        }
        res.send({ admin });
      } catch (error) {
        console.log(error.message);
      }
    });

    // save users data
    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        // insert email if user doesn't exists:
        // you can do this many ways (1. email unique, 2. upsert 3.simple checking)
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: "user already exists", insertedId: null });
        }

        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.log(error.massage);
      }
    });
    // for admin user / updated
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const filter = { _id: new ObjectId(id) };
          const updatedDoc = {
            $set: {
              role: "admin",
            },
          };
          const result = await userCollection.updateOne(filter, updatedDoc);
          res.send(result);
        } catch (error) {
          console.log(error.message);
        }
      }
    );

    // Delete user
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // Menu related api

    // get all menu data from server
    app.get("/menu", async (req, res) => {
      try {
        const result = await menuCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error.massage);
      }
    });

    // Get menu data by id for update
    app.get("/menu/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await menuCollection.findOne({ _id: id });
        console.log(result, "result");
        res.send(result);
      } catch (error) {
        console.log(error.massage);
      }
    });
    // update menu item by id
    app.patch("/menu/:id", async (req, res) => {
      try {
        const item = req.body;
        const id = req.params.id;
        const filter = { _id: id };
        const updatedDoc = {
          $set: {
            name: item.name,
            category: item.category,
            price: item.price,
            recipe: item.recipe,
            image: item.image,
          },
        };
        const result = await menuCollection.updateOne(filter, updatedDoc);
        res.send(result);
        console.log(result, " updated result 203 line");
      } catch (error) {
        console.log(error.message);
      }
    });

    // save to server menu data
    app.post("/menu", async (req, res) => {
      try {
        const item = req.body;
        const result = await menuCollection.insertOne(item);
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // Delete menu item
    app.delete("/menu/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await menuCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error.massage);
      }
    });

    // get all reviews data
    app.get("/reviews", async (req, res) => {
      try {
        const result = await reviewCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.log(error.massage);
      }
    });

    //  all carts collection

    // get data from server
    app.get("/carts", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        const result = await cartCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // save to server
    app.post("/carts", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const cartItem = req.body;
        const result = await cartCollection.insertOne(cartItem);
        res.send(result);
        console.log(result, "cart Item");
      } catch (error) {
        error.message;
      }
    });
    // Cart items delete from server
    app.delete("/carts/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await cartCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });
    // Payment intent
    app.post("/create-payment-intent", async (req, res) => {
      try {
        const { price } = req.body;
        const amount = parseInt(price * 100);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "myr",
          payment_method_types: ["card"],
        });
        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        console.log(error.message);
      }
    });
    // get payment data from server
    app.get("/payments/:email", verifyToken, async (req, res) => {
      try {
        const query = { email: req.params.email };
        if (req.params.email !== req.decoded.email) {
          return res.status(403).send({ massage: "forbidden access" });
        }
        const result = await paymentCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.log(error.message);
      }
    });

    // save payment data

    app.post("/payments", async (req, res) => {
      try {
        const payment = req.body;
        const paymentResult = await paymentCollection.insertOne(payment);

        // carefully delete each item from the cart
        console.log("payment info", payment);
        const query = {
          _id: {
            $in: payment.cartIds.map((id) => new ObjectId(id)),
          },
        };
        const deleteResult = await cartCollection.deleteMany(query);

        res.send({ paymentResult, deleteResult });
      } catch (error) {
        console.log(error.message);
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //  await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("my-restaurant is here");
});

app.listen(port, () => {
  console.log(`MY Restaurant server is Running ........!! ${port}`);
});
