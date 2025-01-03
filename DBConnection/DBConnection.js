const { MongoClient, ServerApiVersion } = require('mongodb');

//Local Connection
// const uri = process.env.LOCAL_DATA_BASE_URL;

//Online Connection
const uri = process.env.ONLINE_DATA_BASE_URL;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function dbConnect() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Quick Edu Live Server successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
};

// Database collections
const QELDB = client.db('quickEduLiveDatabase');
const classesCollection = QELDB.collection('classes');
const usersCollection = QELDB.collection('users');
const announcementsCollection = QELDB.collection('announcements');
const classworkCollection = QELDB.collection('classwork');
const checkingCollection = QELDB.collection('checking');
const enrollmentCollection = QELDB.collection('enrollments');
const submissionCollection = QELDB.collection('submissions');
const feedbackCollection = QELDB.collection('feedback');
const reportCollection = QELDB.collection('report');
const paymentCollection = QELDB.collection('payment');
const presentationCollection = QELDB.collection('presentation');
const moduleCollection = QELDB.collection('module');
const conversations = QELDB.collection('conversations');


module.exports = {
    dbConnect,
    usersCollection,
    classesCollection,
    announcementsCollection,
    classworkCollection,
    checkingCollection,
    enrollmentCollection,
    submissionCollection,
    feedbackCollection,
    reportCollection,
    paymentCollection,
    presentationCollection,
    moduleCollection,
    conversations
}