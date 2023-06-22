const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c1jlj01.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)

        const usersCollection = client.db("languageDb").collection("users");
        const classesCollection = client.db("languageDb").collection("classes");
        const selectedCollection = client.db("languageDb").collection("selected");
        const paymentCollection = client.db("languageDb").collection("payments");

        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

            res.send({ token })
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }



        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollection.insertOne(user);
            res.send(result);
        });


        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log(email);

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            console.log(user);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })
        //instructors
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            console.log(email);

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            console.log(user);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };

            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.get('/allInstructors', async (req, res) => {
            const cursor = usersCollection.find({ role: "instructor" });
            const result = await cursor.toArray();
            res.send(result);
        })
        //classes
        app.get('/allClasses', async (req, res) => {
            const cursor = classesCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/approvedClasses', async (req, res) => {
            const cursor = classesCollection.find({ status: "approved" });
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/classes', async (req, res) => {
            console.log(req.query.email);
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            console.log(query);
            const result = await classesCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/classes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classesCollection.findOne(query);
            res.send(result);
        })

        app.patch('/classes/approved/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'approved'
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.patch('/classes/denied/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    status: 'denied'
                },
            };
            const result = await classesCollection.updateOne(filter, updateDoc);
            res.send(result);

        })

        app.post('/classes', async (req, res) => {
            const newClass = req.body;
            console.log(newClass);
            const result = await classesCollection.insertOne(newClass);
            res.send(result);
        })

        app.put('/classes/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updatedClass = req.body;
            const sClass = {
                $set: {
                    name: updatedClass.name,
                    photo: updatedClass.photo,
                    instructor: updatedClass.instructor,
                    email: updatedClass.email,
                    seats: updatedClass.seats,
                    price: updatedClass.price,
                    status: updatedClass.status
                }
            }
            const result = await classesCollection.updateOne(filter, sClass, options);
            res.send(result);
        })
        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const feedbackClass = req.body;
            const fClass = {
                $set: {
                    name: feedbackClass.name,
                    photo: feedbackClass.photo,
                    instructor: feedbackClass.instructor,
                    email: feedbackClass.email,
                    seats: feedbackClass.seats,
                    price: feedbackClass.price,
                    status: feedbackClass.status,
                    feedback: feedbackClass.feedback
                }
            }
            const result = await classesCollection.updateOne(filter, fClass, options);
            res.send(result);
        })

        app.post('/selectedClasses', async (req, res) => {
            const sClass = req.body;
            console.log(sClass);
            const result = await selectedCollection.insertOne(sClass);
            res.send(result);
        })
        app.get('/selectedClasses', async (req, res) => {
            console.log(req.query.sEmail);
            let query = {};
            if (req.query?.sEmail) {
                query = { sEmail: req.query.sEmail }
            }
            console.log(query);
            const result = await selectedCollection.find(query).toArray();
            res.send(result);
        })

        app.get('/selectedClasses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await selectedCollection.findOne(query);
            res.send(result);
        })

        app.delete('/selectedClasses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedCollection.deleteOne(query);
            res.send(result);
        })

        app.get('/popularClasses', async (req, res) => {
            const query = {}
            const options = {
                sort: { "enrolled": -1 }
            }
            const cursor = classesCollection.find(query, options).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        })

        app.get('/popularInstructors', async (req, res) => {
            const cursor = usersCollection.find({ role: "instructor" }).limit(6);
            const result = await cursor.toArray();
            res.send(result);
        })

        //Payment
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //payment API
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);
            const delId = payment.class;
            const query = { _id: new ObjectId(delId) }
            const deleteResult = await selectedCollection.deleteOne(query);
            res.send({insertResult, deleteResult});
        })

        app.get('/payments', async (req, res) => {
            console.log(req.query.email);
            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            console.log(query);
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('LanguageShala is running');
})

app.listen(port, () => {
    console.log(`LanguageShala is running on port: ${port}`);
})