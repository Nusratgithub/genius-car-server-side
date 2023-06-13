const express = require('express')
const jwt=require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_KEY);

const app = express();
const cors = require('cors')
const port = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('platform running')
})

app.use(cors());
app.use(express.json());

console.log(process.env.DB_USER);
console.log(process.env.DB_PASSWORD);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.9y7gcsu.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri);

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).send({ message: 'unauthorized access' });
  }
  const token = authHeader.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  })
}

// async await
async function run() {
  try {
    const userCollection = client.db("geniusCar").collection("service");
    const orderCollection = client.db("geniusCar").collection("orders");
    const paymentCollection = client.db("geniusCar").collection("payment");
    
    app.post('/jwt', (req, res) => {
      const user = req.body;
      console.log(user)
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
      res.send({ token })
    })
   
    app.get('/services', async (req, res) => {
      const query = {};
      const cursor = userCollection.find(query);
      const service = await cursor.toArray();
      res.send(service);
    })
    app.get('/services/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const user = await userCollection.findOne(query)
      res.send(user);
    })

    // orders api
    app.post('/orders', async (req, res) => {
      const order = req.body;
      console.log(order);
      const result = await orderCollection.insertOne(order)
      res.send(result);
    }) 
    app.get('/orders', async (req, res) => {
      console.log(req.query.email);
      let query = {};
      if (req.query.email) {
        query = {
          email: req.query.email
        }
      }
      const cursor = orderCollection.find(query);
      const orders = await cursor.toArray();
      res.send(orders);
    })
    app.get('/orders/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) }
      const user = await orderCollection.findOne(query)
      res.send(user);
    })
    app.patch('/orders/:id', async (req, res) => {
      const id = req.params.id;
      const status = req.body.status
      const query = { _id: ObjectId(id) }
      const updatedDoc = {
        $set: {
          status: status
        }
      }
      const result = await orderCollection.updateOne(query, updatedDoc);
      res.send(result);
    })

    app.delete('/orders/:id',verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    })
    /* =========================
    * Stripe Payment Api Endpoint
     =========================*/
    // Stripe payment Implement

    app.post('/create-payment-intent', async (req, res) => {
      const order = req.body
      // console.log(order)
      const price = order.price
      const amount = price * 100
      const paymentIntent = await stripe.paymentIntents.create({
        currency: 'usd',
        amount: amount,
        "payment_method_types": ["card"],
      
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      });
        
    });
    // Save payments data in database
    app.post('/payments', async (req, res) => {
      const payment = req.body
      console.log(req.body)
      const payments = await paymentCollection.insertOne(payment)
      const id = payment.bookingId
      const filterOrder = { _id: ObjectId(id) }
      
      const orderUpdatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const updatePayments = await orderCollection.updateOne(filterOrder, orderUpdatedDoc)
      // const updateProductsStatus = await productCollection.updateOne(filterProduct, productUpdatedDoc)
      console.log(updatePayments)
      res.send(payments)
      
    })
  }
  finally {

  }
}

run().catch(err => {
  console.log(err)
})

app.listen(port, () => {
  console.log(`simple node server running on port ${port}`);
}) 