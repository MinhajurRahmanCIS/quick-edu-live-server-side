const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const T = require("tesseract.js");
const port = process.env.PORT || 5000;
const SSLCommerzPayment = require('sslcommerz-lts');
const http = require('http');
const { Server } = require('socket.io');

//Requiring MongoDB Connection & Collections
const { dbConnect,
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
} = require('./DBConnection/DBConnection');

//Requiring CRUD Functions
const { getData,
    getSpecificData,
    postData,
    updateData,
    deleteData,
    getAUser
} = require('./CRUD/CRUD');


//Middleware
app.use(cors());
app.use(express.json());

//MongoDb Connection
dbConnect().catch(console.dir + 'MongoDb Connection Error');

//Requiring gemini AI 
const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");

//Selected gemini AI Model and configuration 
// const MODEL_NAME = "gemini-1.0-pro"; // old model
// const MODEL_NAME = "gemini-1.5-flash"; // new model
const MODEL_NAME = "gemini-1.5-pro"; // new model
const API_KEY = process.env.GEMINI_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const generationConfig = {
    temperature: 0.9,
    topK: 1,
    topP: 1,
    maxOutputTokens: 2048,
};

const safetySettings = [
    {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
];

const chat = model.startChat({
    generationConfig,
    safetySettings,
    history: [
    ],
});

// For text-only input, use the gemini-pro model
async function checkPaper(question, answer) {
    // console.log(studentName, studentId, subject)
    const prompt = `You role is University Teacher. Now here is question : ${question}. Read the question. Here is student answer of the questions ${answer}. Now give the student proper mark based on question.Please provide the response in pure JSON format. Avoid using ${"json"} and ${""} to enclose the JSON.
    Carefully follow the Example:
        "question": [
            {"_id": "count on sequence",
            "question": "1/2/3",
            "totalMarks": "",
            "marksGet": "",
        ]
       }      
        `

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    // console.log(text);
    return text;
};



// Requiring JWT Function to get user_token, verifyJWT user, verifyAdmin
const { user_token,
    verifyJWT,
    verifyAdmin
} = require('./JWT_Token/JWT_Token');
const { ObjectId } = require('mongodb');


// JWT user Token generate
app.get('/jwt', (req, res) => {
    const email = req.query.email;
    const userToken = user_token(email, usersCollection);
    userToken
        .then(accessToken => {
            return res.send({
                success: true,
                message: "User Token Generated",
                data: accessToken,
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// sslCommerceZ API Config
const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWD
const is_live = false


// Users
// Getting Users 

app.get('/users', async (req, res) => {
    // Showing Specific Email User 
    let query = {};
    if (req.query.email) {
        query = {
            email: req.query.email
        };
    };
    const getUser = getData(usersCollection, query);
    getUser
        .then(result => {
            return res.send({
                success: true,
                message: "User Found!!",
                data: result,
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

app.get('/users/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email };

    const getUser = getAUser(usersCollection, query);
    getUser
        .then(result => {
            return res.send({
                success: true,
                message: "User Found!!",
                data: result,
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// Getting User Role
app.get('/users/teacher/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email };

    const getUser = getAUser(usersCollection, query);
    getUser
        .then(result => {
            return res.send({
                success: true,
                message: "Teacher!!",
                data: { isTeacher: result?.role === "Teacher" },
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
})

app.get('/users/premium/:email', async (req, res) => {
    const email = req.params.email;
    const query = { email };

    const getUser = getAUser(usersCollection, query);
    getUser
        .then(result => {
            return res.send({
                success: true,
                message: "Premium!!",
                data: { isPremium: result?.account === "Premium" },
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
})

// Getting Specific Users
// app.get('/users/:id', verifyJWT, async (req, res) alternative for verifyJWT
app.get('/users/:id', async (req, res) => {
    const id = req.params.id;
    const getSpecificUser = getSpecificData(id, usersCollection);
    getSpecificUser
        .then(result => {
            return res.send({
                success: true,
                message: "Specific User Found",
                data: result
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// Creating new user
// app.post('/users', async (req, res) alternative for verifyJWT
app.post('/users', async (req, res) => {
    const data = req.body;
    const userExist = await usersCollection.findOne({ email: data.email });
    if (userExist) {
        return res.send({
            success: false,
            message: "User Already Exits"
        });
    }
    const user = postData(usersCollection, data);
    user
        .then(result => {
            return res.send({
                success: true,
                message: "New User Added",
                data: result
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// UpdateUser
// app.put('/users/:id', async (req, res) alternative for verifyJWT
app.put('/users/:id', async (req, res) => {
    const id = req.params.id;
    const updatedData = req.body;
    const options = {};
    const updatedUserData = {
        $set: updatedData
    };
    const userClass = updateData(id, updatedUserData, options, usersCollection);
    userClass
        .then(result => {
            return res.send({
                success: true,
                message: "User Updated",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

app.put('/usersSkill/:id', async (req, res) => {
    const { id } = req.params;
    const { skill } = req.body; // skill should be sent from frontend
    const updatedUserData = { skill }; // skills array

    try {
        const user = await usersCollection.findOne({ _id: new ObjectId(id) });

        if (!user) {
            return res.status(404).send({ success: false, message: "User not found" });
        }

        const hasSkill = user.skills?.includes(skill);

        if (!hasSkill) {
            const result = await usersCollection.updateOne(
                { _id: new ObjectId(id) },
                { $addToSet: { skills: skill } } // Only adds skill if not already in the array
            );
            return res.send({
                success: true,
                message: "Skill added successfully",
                data: result,
            });
        } else {
            return res.send({
                success: false,
                message: "Skill already exists",
            });
        }
    } catch (err) {
        return res.status(500).send({
            success: false,
            message: err.message,
        });
    }
});

// Deleting Users
app.delete('/users/:id', async (req, res) => {
    const id = req.params.id;
    const deleteUser = deleteData(id, usersCollection);
    deleteUser
        .then(result => {
            return res.send({
                success: true,
                message: "Users Deleted",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});


// Classes
// Getting Classes 
// app.get('/class', verifyJWT, async (req, res) alternative for verifyJWT

app.get('/classes', verifyJWT, async (req, res) => {
    const email = req.query.email;
    const decodedEmail = req.decoded.email;

    if (email !== decodedEmail) {
        return res.status(403).send({ message: 'forbidden access' });
    };
    // Showing Specific Email Classes 
    let query = {};

    if (req.query.email) {
        query = {
            email: req.query.email
        };
    };

    const getClass = getData(classesCollection, query);
    getClass
        .then(result => {
            return res.send({
                success: true,
                message: "Class Found!!",
                data: result,
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});


app.get('/suggestedClasses/:email', async (req, res) => {
    const email = req.params.email; // Get the user email from query params

    try {
        // Fetch the user's skills from usersCollection based on email
        const user = await usersCollection.findOne({ email: email });
        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        const userSkills = user.skills || []; // Get the user's skills array
        if (userSkills.length === 0) {
            return res.send({
                success: false,
                message: "No skills found for the user."
            });
        }

        // Filter classes that match the user's skills
        const query = {
            subject: { $in: userSkills } // Match classes where the subject is in user's skills
        };

        const suggestedClasses = await classesCollection.find(query).toArray();

        if (suggestedClasses.length === 0) {
            return res.send({
                success: false,
                message: "No classes found matching user's skills.",
                data: []
            });
        }

        return res.send({
            success: true,
            message: "Suggestion found!",
            data: suggestedClasses
        });

    } catch (err) {
        return res.status(500).send({
            success: false,
            message: err?.message
        });
    }
});


// Getting Specific Class
// app.get('/class/:id', verifyJWT, async (req, res) alternative for verifyJWT
app.get('/classes/:id', async (req, res) => {
    const id = req.params.id;
    const getSpecificClass = getSpecificData(id, classesCollection);
    getSpecificClass
        .then(result => {
            return res.send({
                success: true,
                message: "Specific Class Found",
                data: result
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// Creating new class
// app.post('/class', async (req, res) alternative for verifyJWT
app.post('/classes', async (req, res) => {
    const data = req.body;
    const newClass = postData(classesCollection, data);
    newClass
        .then(result => {
            return res.send({
                success: true,
                message: "New Class Created",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// UpdateClass
// app.put('/class/:id', async (req, res) alternative for verifyJWT
app.put('/classes/:id', async (req, res) => {
    const id = req.params.id;
    const classData = req.body;
    const options = { upsert: true };
    const updatedClassData = {
        $set: {
            name: classData.name
        }
    };
    const updateClass = updateData(id, updatedClassData, options, classesCollection);
    updateClass
        .then(result => {
            return res.send({
                success: true,
                message: "Class Updated",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// Deleting Classes
// app.delete('/class/:id', async (req, res) alternative for verifyJWT
app.delete('/classes/:id', async (req, res) => {
    const id = req.params.id;
    const deleteClass = deleteData(id, classesCollection);
    deleteClass
        .then(result => {
            return res.send({
                success: true,
                message: "Class Deleted",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// Enroll Student
// app.post('/class', async (req, res) alternative for verifyJWT
app.post('/enrollments', async (req, res) => {
    const data = req.body;
    const enrollmentKey = data.classCode;
    const email = data.studentEmail;

    const classInfo = await classesCollection.findOne({ classCode: enrollmentKey });
    if (classInfo) {
        const query = { email, classId: classInfo._id };
        const existingEnrollment = await enrollmentCollection.findOne(query);

        if (existingEnrollment) {
            return res.send({
                success: false,
                alreadyEnrolledMessage: "Already enrolled!"
            })
        };

        const enroll = postData(enrollmentCollection, query);
        enroll
            .then(result => {
                return res.send({
                    success: true,
                    message: "Student Enrollment Successfully",
                    data: result,
                })
            })
            .catch(error => {
                return res.send({
                    success: false,
                    message: error?.message
                })
            });
    }
    else {
        return res.send({
            success: false,
            noClassMessage: "Class not exits"
        })
    };
});


app.get('/enrollments', async (req, res) => {
    let query = {};

    if (req.query.email) {
        query = {
            email: req.query.email
        };
    };

    // Fetch enrollment data
    getData(enrollmentCollection, query)
        .then(async enrollmentData => {
            // Extract classIds from the enrollment data
            const classIds = enrollmentData.map(enrollment => enrollment.classId);

            // Fetch class information using classIds
            const classDataPromises = classIds.map(classId => getData(classesCollection, { _id: classId }));
            const classDataArray = await Promise.all(classDataPromises);
            // Combine enrollment data with class information
            const combinedData = enrollmentData.map((enrollment_1, index) => ({
                ...enrollment_1,
                classInfo: classDataArray[index]
            }));
            // Send the response with combined data
            res.send({
                success: true,
                message: "Enrollment and Class Data Found!!",
                data: combinedData,
            });
        })
        .catch(err => {
            res.send({
                success: false,
                message: err?.message || "An error occurred while fetching data"
            });
        });
});


app.delete('/enrollments/:id', async (req, res) => {
    const id = req.params.id;
    const deleteEnrollClass = deleteData(id, enrollmentCollection);
    deleteEnrollClass
        .then(result => {
            return res.send({
                success: true,
                message: "Enroll Class Deleted",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// Enrollment People
// Getting Classes 
// app.get('/enrollmentPeople', verifyJWT, async (req, res) alternative for verifyJWT

app.get('/enrollmentPeople', async (req, res) => {
    let query = {};
    if (req.query.classId) {
        query.classId = new ObjectId(req.query.classId);
    }

    const enrollments = await enrollmentCollection.find(query).toArray();

    const userDetailsPromises = enrollments.map(enrollment =>
        usersCollection.findOne({ email: enrollment.email })
    );

    const userDetails = await Promise.all(userDetailsPromises);
    res.send({
        success: true,
        message: "People Found!!",
        data: userDetails,
    });
});


// Deleting Enrollment People
// app.delete('/class/:id', async (req, res) alternative for verifyJWT
app.delete('/enrollmentPeople/:email', async (req, res) => {
    const email = req.params.email;
    const remove = await enrollmentCollection.deleteOne({ email: email });
    res.send({
        success: true,
        message: "Student Remove",
        data: remove,
    });
});



app.get('/viewSubmission/:id', async (req, res) => {
    try {
        const quizId = req.params.id;

        // Fetch submissions for the given quiz ID
        const checkSubmissions = await submissionCollection.find({ quizId: quizId }).toArray();

        // mapping submitted users
        const userEmails = [...new Set(checkSubmissions.map(submission => submission.userEmail))];

        // Fetch user details for each submitted user email
        const userDetails = await usersCollection.find({ email: { $in: userEmails } }).toArray();
        const userMap = {};
        userDetails.forEach(user => {
            userMap[user.email] = { name: user.name, image: user.image };
        });

        // adding user Name and user Picture details with submissions
        const viewSubmission = checkSubmissions.map(submission => ({
            ...submission,
            userName: userMap[submission.userEmail]?.name,
            userPicture: userMap[submission.userEmail]?.image
        }));

        // Send the modified response
        res.send({
            success: true,
            message: "View Submissions",
            data: viewSubmission
        });
    } catch (error) {
        res.send({
            success: false,
            message: "Error in View Submissions"
        });
    }
});

app.get('/viewAssignmentSubmission/:id', async (req, res) => {
    try {
        const assignmentId = req.params.id;

        // Fetch submissions for the given quiz ID
        const checkSubmissions = await submissionCollection.find({ assignmentId: assignmentId }).toArray();

        // mapping submitted users
        const userEmails = [...new Set(checkSubmissions.map(submission => submission.userEmail))];

        // Fetch user details for each submitted user email
        const userDetails = await usersCollection.find({ email: { $in: userEmails } }).toArray();
        const userMap = {};
        userDetails.forEach(user => {
            userMap[user.email] = { name: user.name, image: user.image };
        });

        // adding user Name and user Picture details with submissions
        const viewSubmission = checkSubmissions.map(submission => ({
            ...submission,
            userName: userMap[submission.userEmail]?.name,
            userPicture: userMap[submission.userEmail]?.image
        }));

        // Send the modified response
        res.send({
            success: true,
            message: "View Submissions",
            data: viewSubmission
        });
    } catch (error) {
        res.send({
            success: false,
            message: "Error in View Submissions"
        });
    }
});


app.get('/checkSubmission', async (req, res) => {
    const studentEmail = req.query.email;
    const quiz = req.query.quiz;
    const assignment = req.query.assignment;
    let query = {
        userEmail: studentEmail,
        $or: []
    };

    if (quiz) {
        query.$or.push({ quizId: { $exists: true } });
    }

    if (assignment) {
        query.$or.push({ assignmentId: { $exists: true } });
    }

    try {
        const checkSubmissions = await submissionCollection.find(query).toArray();
        res.send({
            success: true,
            message: "Submissions",
            data: checkSubmissions
        });
    } catch (error) {
        res.send({
            success: false,
            message: "An error occurred while fetching submissions",
            error: error.message
        });
    }
});



app.get('/submission', async (req, res) => {
    const studentEmail = req.query.email;
    const qId = req.query.qId;
    const result = await submissionCollection.findOne({ userEmail: studentEmail, quizId: qId });
    res.send({
        success: true,
        message: "Result!",
        data: result,
    })
});

app.delete('/submission/:id', async (req, res) => {
    const id = req.params.id;
    const deleteSubmission = deleteData(id, submissionCollection);
    deleteSubmission
        .then(result => {
            return res.send({
                success: true,
                message: "Submission Deleted",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

app.get('/assignmentSubmission', async (req, res) => {
    const studentEmail = req.query.email;
    const asgId = req.query.qId;
    const result = await submissionCollection.findOne({ userEmail: studentEmail, quizId: qId });
    res.send({
        success: true,
        message: "Result!",
        data: result,
    })
});


// Creating Submission
// app.post('/class', async (req, res) alternative for verifyJWT
app.post('/submission', async (req, res) => {
    const data = req.body;
    const submission = postData(submissionCollection, data);
    submission
        .then(result => {
            return res.send({
                success: true,
                message: "Submission Done!",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});


// Announcements
// Getting Announcements 
// app.get('/announcements', verifyJWT, async (req, res) alternative for verifyJWT

app.get('/announcements', async (req, res) => {
    // Showing Specific Email Classes 
    let query = {};
    if (req.query.classId) {
        query = {
            classId: req.query.classId
        };
    };

    let sortOption = {};
    if (req.query.sorted) {
        sortOption['_id'] = parseInt(req.query.sorted); // Sort ascending if sortField is provided
    } else {
        sortOption['_id'] = 1; // Sort by _id field ascending if sortField is not provided
    };

    const getAnnouncements = getData(announcementsCollection, query, sortOption);
    getAnnouncements
        .then(result => {
            return res.send({
                success: true,
                message: "Announcements Found!!",
                data: result,
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// Creating new Announcements
// app.post('/announcements', async (req, res) alternative for verifyJWT
app.post('/announcements', async (req, res) => {
    const data = req.body;
    const newAnnouncement = postData(announcementsCollection, data);
    newAnnouncement
        .then(result => {
            return res.send({
                success: true,
                message: "Announcement Created",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});


// Deleting Announcements
// app.delete('/classwork/:id', async (req, res) alternative for verifyJWT
app.delete('/announcements/:id', async (req, res) => {
    const id = req.params.id;
    const deleteAnnouncement = deleteData(id, announcementsCollection);
    deleteAnnouncement
        .then(result => {
            return res.send({
                success: true,
                message: "Announcements Deleted",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

// Comments
// Getting Comments 
// app.get('/announcements', verifyJWT, async (req, res) alternative for verifyJWT

app.get('/comments', async (req, res) => {
    // Showing Specific Email Classes 
    let query = {};
    if (req.query.announcementId) {
        query = {
            announcementId: req.query.announcementId
        };
    };

    let sortOption = {};
    if (req.query.sorted) {
        sortOption['_id'] = parseInt(req.query.sorted); // Sort ascending if sortField is provided
    } else {
        sortOption['_id'] = 1; // Sort by _id field ascending if sortField is not provided
    };

    const getAnnouncements = getData(announcementsCollection, query, sortOption);
    getAnnouncements
        .then(result => {
            return res.send({
                success: true,
                message: "Announcements Found!!",
                data: result,
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});


// Creating new classwork
// app.post('/classwork', async (req, res) alternative for verifyJWT
// app.post('/classwork', async (req, res) => {
//     const data = req.body;
//     console.log("req data /n", data)

//     const classId = data.classId;
//     const subject = data.subject;
//     const quizNo = data.quizNo;
//     const date = data.date;
//     const time = data.time;
//     // const time = data.time + data.timePeriod;
//     const examDuration = data.duration + " " + data.timeUnit;
//     const totalQuestions = data.totalQuestions;
//     const level = data.level;
//     const topic = data.topic;
//     const questionPattern = 'a), b), c), d)';

//     // Assignment
//     const assignmentNo = data.assignmentNo;
//     const example = data.example;
//     const description = data.description;


//     // const prompt =
//     //     `Make ${subject} Question Provide correct answer. Subject: ${subject}. Total Question: ${totalQuestions}. Question Pattern: ${questionPattern}. give it in pure json format. Please stop giving starting ${"```json"} and ${"```"} don't give ${' \n \n'} 
//     //     `
//     //     ;
//     let prompt;

//     if (quizNo) {
//         prompt =
//             `Generate ${subject} questions with the topic ${topic} and provide the correct answers. Subject: ${subject}. Total Questions: ${totalQuestions}. Question Pattern: ${questionPattern}. Please provide the response in pure JSON format. Avoid using ${"json"} and ${""} to enclose the JSON.
//             Carefully follow the Example:
//         {
//                 "quizNo": ${quizNo},
//                 "classId": ${classId},  
//                     "date": ${date}, 
//                     "time": ${time}, 
//                     "examDuration": ${examDuration}, 
//                     "level": ${level}, 
//                     "topic": ${topic},
//                 {
//                     "questions": [
//                         {"_id": "count on sequence",
//                         "question": "",
//                         "options": ["a)", "b)", "c)", "d)"],
//                         "correctAnswer": ""
//                     ]
//                    }
//         }
//         `;
//     }
//     else {
//         prompt = `Generate ${subject} assignment that contain these topics: ${topic} with a scenario and number of questions ${totalQuestions}. Please provide the response in pure JSON format. Avoid using ${"json"} and ${""} to enclose the JSON. Carefully follow the example:

//     {
//             "assignmentNo": ${assignmentNo},
//             "classId": ${classId},  
//             "date": ${date}, 
//             "time": ${time},
//             "level": ${level},
//             "topic": ${topic}, 
//             "scenario": "Write the scenario based on your question"
//             {
//                 "questions": [
//                     {"_id": "count on sequence",
//                     "question": "${totalQuestions}",
//                     "correctAnswer": "Proper Details"
//                 ]
//                }
//     }
//     `;
//     }

//     console.log("prompt", prompt)

//     const result = await model.generateContent(prompt);
//     const response = await result.response;
//     const text = response.text();
//     console.log(text);

//     // Parse the JSON string into an array of objects
//     // const textToArray = JSON.parse(text);

//     let textToArray; // Declare textToArray outside of the try-catch block

//     try {
//         textToArray = JSON.parse(text);  // Continue here if parsing is successful
//     } catch (error) {
//         res.send("Something Went wrong. Please Try Again");
//     }

//     console.log("Response", textToArray);



//     if (quizNo && (!textToArray?.quizNo || !textToArray?.classId || !textToArray?.date || !textToArray?.time || !textToArray?.examDuration || !textToArray?.level || !textToArray?.topic || classId != textToArray?.classId)) {
//         return res.send("Something Went wrong. Please Try Again");
//     };

//     console.log(assignmentNo)

//     if (assignmentNo && (!textToArray?.assignmentNo || !textToArray?.classId || !textToArray?.date || !textToArray?.time || !textToArray?.level || !textToArray?.scenario || !textToArray?.topic || classId != textToArray?.classId)) {
//         return res.send("Something Went wrong. Please Try Again");
//     };

//     const classwork = postData(classworkCollection, textToArray);
//     classwork
//         .then(result => {

//             return res.send({
//                 success: true,
//                 message: "Classwork Created",
//                 data: result,
//             })
//         })
//         .catch(err => {
//             return res.send({
//                 success: false,
//                 message: err?.message
//             })
//         });
// });

app.post('/classwork', async (req, res) => {
    const data = req.body;
    console.log("req data \n", data);

    const classId = data.classId;
    const subject = data.subject;
    const quizNo = data.quizNo;
    const date = data.date;
    const time = data.time;
    const examDuration = data.duration + " " + data.timeUnit;
    const totalQuestions = data.totalQuestions;
    const level = data.level;
    const topic = data.topic;
    const questionPattern = 'a), b), c), d)';

    const assignmentNo = data.assignmentNo;
    const example = data.example;
    const description = data.description;

    let prompt;

    if (quizNo) {
        prompt = `Generate ${subject} questions with the topic ${topic} and provide the correct answers. Subject: ${subject}. Total Questions: ${totalQuestions}. Question Pattern: ${questionPattern}. Please provide the response in pure JSON format. Avoid using "json" and "" to enclose the JSON.
            Carefully follow the Example:
        {
            "quizNo": ${quizNo},
            "classId": "${classId}",  
            "date": "${date}", 
            "time": "${time}", 
            "examDuration": "${examDuration}", 
            "level": "${level}", 
            "topic": "${topic}",
            "questions": [
                {
                    "_id": "count on sequence",
                    "question": "",
                    "options": ["a)", "b)", "c)", "d)"],
                    "correctAnswer": "a)/b)/c)/d) The full answer"
                }
            ]
        }`;
    } else {
        prompt = `Generate ${subject} assignment that contain these topics: ${topic} with a scenario and number of questions ${totalQuestions}. Please provide the response in pure JSON format. Avoid using "json" and "" to enclose the JSON. Carefully follow the example:
        {
            "assignmentNo": ${assignmentNo},
            "classId": "${classId}",  
            "date": "${date}", 
            "time": "${time}",
            "level": "${level}",
            "topic": "${topic}", 
            "scenario": "Write the scenario based on your question",
            "questions": [
                {
                    "_id": "count on sequence",
                    "question": "${totalQuestions}",
                    "correctAnswer": "Proper Details"
                }
            ]
        }`;
    }

    console.log("prompt", prompt);

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        console.log(text);

        let textToArray = JSON.parse(text);

        console.log("Response", textToArray);

        if (quizNo && (!textToArray?.quizNo || !textToArray?.classId || !textToArray?.date || !textToArray?.time || !textToArray?.examDuration || !textToArray?.level || !textToArray?.topic || classId != textToArray?.classId)) {
            return res.send("Something Went wrong. Please Try Again");
        }

        if (assignmentNo && (!textToArray?.assignmentNo || !textToArray?.classId || !textToArray?.date || !textToArray?.time || !textToArray?.level || !textToArray?.scenario || !textToArray?.topic || classId != textToArray?.classId)) {
            return res.send("Something Went wrong. Please Try Again");
        }

        const classwork = await postData(classworkCollection, textToArray);

        return res.send({
            success: true,
            message: "Classwork Created",
            data: classwork,
        });
    } catch (error) {
        console.error(error);
        return res.send("Something Went wrong. Please Try Again");
    }
});



app.get('/classwork', async (req, res) => {
    // const email = req.query.email;
    // const decodedEmail = req.decoded.email;

    // if (email !== decodedEmail) {
    //     return res.status(403).send({ message: 'forbidden access' });
    // };


    if (req.query.classId && req.query.quizNo || req.query.assignmentNo) {
        query = {
            classId: req.query.classId,
            $or: []
        };

        if (req.query.quizNo) {
            query.$or.push({ "quizNo": { $exists: true } });
        };

        if (req.query.assignmentNo) {
            query.$or.push({ "assignmentNo": { $exists: true } });
        };

        const getClasswork = getData(classworkCollection, query);
        getClasswork
            .then(result => {
                return res.send({
                    success: true,
                    message: "Class work Found!!",
                    data: result,
                });
            })
            .catch(err => {
                return res.send({
                    success: false,
                    message: err?.message
                })
            });
    };
});

// Getting Specific classwork
// app.get('/class/:id', verifyJWT, async (req, res) alternative for verifyJWT
app.get('/classwork/:id', async (req, res) => {
    const id = req.params.id;
    const getSpecificClasswork = getSpecificData(id, classworkCollection);
    getSpecificClasswork
        .then(result => {
            return res.send({
                success: true,
                message: "Specific Class work Found",
                data: result
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});


// Deleting Quiz
// app.delete('/class/:id', async (req, res) alternative for verifyJWT
app.delete('/classwork/:id', async (req, res) => {
    const id = req.params.id;
    const getSpecificClasswork = deleteData(id, classworkCollection);
    getSpecificClasswork
        .then(result => {
            return res.send({
                success: true,
                message: "Quiz Deleted",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

//  The `punycode` module is deprecated. shows in command
// Checking paper
app.post('/check', async (req, res) => {
    const data = req.body;
    console.log(data);
    // const studentName = data.studentName;
    // const studentId = data.studentId;
    // const subject = data.subject;
    const question = data.questionImg;
    const answer = data.answerImg;

    let extractedQuestionText = "";
    let extractedAnswerText = "";



    T.recognize(question, 'eng', { logger: e => console.log(e) })
        .then(out => {
            extractedQuestionText = out.data.text;
            T.recognize(answer, 'eng', {
                logger: e => console.log(e)
            })
                .then(out => {
                    extractedAnswerText = out.data.text;;
                    const result = checkPaper(extractedQuestionText, extractedAnswerText);
                    // const result = checkPaper(extractedQuestionText, extractedAnswerText, studentName, studentId, subject);
                    result
                        .then(text => {
                            console.log(text);
                            let textToArray; // Declare textToArray outside of the try-catch block

                            try {
                                textToArray = JSON.parse(text);  // Continue here if parsing is successful
                            } catch (error) {
                                res.send("Something Went wrong. Please Try Again");
                            }
                            const newChecking = postData(checkingCollection, textToArray);
                            newChecking
                                .then(result => {
                                    return res.send({
                                        success: true,
                                        message: "Checking",
                                        data: result,
                                    })
                                })
                                .catch(err => {
                                    return res.send({
                                        success: false,
                                        message: err?.message
                                    })
                                });
                        })
                        .catch(err => {
                            console.error(err);
                        })
                })
                .catch(err => {
                    console.error(err);
                });
        })
        .catch(err => {
            console.error(err);
        });

});

app.get('/check', async (req, res) => {
    let query = {};
    const getCheck = getData(checkingCollection, query);
    getCheck
        .then(result => {
            return res.send({
                success: true,
                message: "Paper Found!!",
                data: result,
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

app.get('/check/:id', async (req, res) => {
    const id = req.params.id;
    const getSpecificPaper = getSpecificData(id, checkingCollection);
    getSpecificPaper
        .then(result => {
            return res.send({
                success: true,
                message: "Specific Paper Found",
                data: result
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});


// Deleting Quiz
// app.delete('/class/:id', async (req, res) alternative for verifyJWT
app.delete('/check/:id', async (req, res) => {
    const id = req.params.id;
    const getSpecificPaper = deleteData(id, checkingCollection);
    getSpecificPaper
        .then(result => {
            return res.send({
                success: true,
                message: "Paper Deleted",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});



app.get('/feedback', async (req, res) => {
    const feedback = getData(feedbackCollection, {}, { _id: -1 });
    feedback
        .then(result => {
            return res.send({
                success: true,
                message: "Class Found!!",
                data: result,
            });
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
});

app.post("/feedback", async (req, res) => {
    const data = req.body;
    const feedback = postData(feedbackCollection, data);
    feedback
        .then(result => {
            return res.send({
                success: true,
                message: "Feedback Success",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
})

app.post("/report", async (req, res) => {
    const data = req.body;
    const report = postData(reportCollection, data);
    report
        .then(result => {
            return res.send({
                success: true,
                message: "Report Success",
                data: result,
            })
        })
        .catch(err => {
            return res.send({
                success: false,
                message: err?.message
            })
        });
})


app.get('/payment/info/:email/:transactionId', async (req, res) => {
    const email = req.params.email;
    const transactionId = req.params.transactionId;
    const query = { email, transactionId };
    const paymentInfo = await paymentCollection.findOne(query);
    res.send(paymentInfo)
})



// Creating new payment
// app.post('/payment', async (req, res) alternative for verifyJWT
app.post('/payment', async (req, res) => {
    const order = req.body;
    const { name, email, amount, currency } = order;
    if (!name || !email || !amount || !currency) {
        return res.send("Something went wrong!");
    };
    const transactionId = new ObjectId().toString();
    const data = {
        total_amount: amount,
        currency: currency,
        tran_id: transactionId, // use unique tran_id for each api call
        success_url: `http://localhost:5000/payment/success/${email}/${transactionId}`,
        fail_url: `http://localhost:5000/payment/fail/${transactionId}`,
        cancel_url: `http://localhost:5000/payment/cancel/${transactionId}`,
        ipn_url: 'http://localhost:3030/ipn',
        shipping_method: 'Online',
        product_name: 'Ai Paper Checker',
        product_category: 'Electronic',
        product_profile: 'general',
        cus_name: name,
        cus_email: email,
        cus_add1: 'Dhaka',
        cus_add2: 'Dhaka',
        cus_city: 'Dhaka',
        cus_state: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: '01711111111',
        cus_fax: '01711111111',
        ship_name: 'Customer Name',
        ship_add1: 'Dhaka',
        ship_add2: 'Dhaka',
        ship_city: 'Dhaka',
        ship_state: 'Dhaka',
        ship_postcode: 1000,
        ship_country: 'Bangladesh',
    };
    const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live)
    sslcz.init(data).then(apiResponse => {
        // Redirect the user to payment gateway
        let GatewayPageURL = apiResponse.GatewayPageURL
        console.log('apiResponse to: ', apiResponse)
        paymentCollection.insertOne({
            ...order,
            transactionId,
            paid: false,
            service: "Ai Paper Checker"
        })
        res.send({ url: GatewayPageURL })
        console.log('Redirecting to: ', GatewayPageURL)
    });
});

app.post('/payment/success/:email/:transactionId', async (req, res) => {
    const email = req.params.email;
    const transactionId = req.params.transactionId;
    if (!transactionId) {
        return res.redirect(`http://localhost:3000/myhome/payment/fail`);
    }
    const result = await paymentCollection.updateOne({ transactionId }, {
        $set:
        {
            paid: true,
            transactionAt: new Date()
        }
    });

    if (result.modifiedCount > 0) {
        const result = await usersCollection.updateOne({ email }, {
            $set: {
                account: "Premium"
            }
        });
        res.redirect(`http://localhost:3000/myhome/payment/success/${email}/${transactionId}`);
    };
})

app.post('/payment/fail/:transactionId', async (req, res) => {
    const transactionId = req.params.transactionId;
    if (!transactionId) {
        return res.redirect(`http://localhost:3000/myhome/payment/fail`);
    }
    const result = await paymentCollection.deleteOne({ transactionId });
    if (result.deletedCount > 0) {
        res.redirect(`http://localhost:3000/myhome/payment/fail`);
    }
})

app.post('/payment/cancel/:transactionId', async (req, res) => {
    const transactionId = req.params.transactionId;
    const result = await paymentCollection.deleteOne({ transactionId });
    if (result.deletedCount > 0) {
        res.redirect(`http://localhost:3000/myhome`);
    }
});

function stripMarkdown(text) {
    // Remove ```json and ``` from the beginning and end
    return text.replace(/^```json\n/, '').replace(/\n```$/, '');
}

// Ai Presentation 
// AI Presentation Generation and Storage
app.post('/presentation/:email', async (req, res) => {
    const { email } = req.params;
    const { topic, tone, pages, description } = req.body;

    const prompt = `Create a presentation outline on "${topic}" with a ${tone} tone. The presentation should have ${pages} pages. Here's a brief description: ${description}. Please return the result as a JSON array where each object represents a slide with 'title' and 'content' properties.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();

        // Strip Markdown syntax and parse JSON
        const cleanedText = stripMarkdown(text);
        const slides = JSON.parse(cleanedText);

        const presentationData = {
            email,
            topic,
            tone,
            pages,
            description,
            slides,
            createdAt: new Date()
        };

        const insertResult = await presentationCollection.insertOne(presentationData);
        res.status(201).send({ message: "Presentation created successfully", id: insertResult.insertedId });
    } catch (error) {
        console.error("Error generating or storing presentation:", error);
        res.status(500).send({ message: "Error creating presentation", error: error.toString() });
    }
});


// Fetch Presentations
app.get('/presentation/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const presentations = await presentationCollection.find({ email }).toArray();
        res.send(presentations);
    } catch (error) {
        console.error("Error fetching presentations:", error);
        res.status(500).send({ message: "Error fetching presentations" });
    }
});

// Ai Presentation 
// AI Presentation Generation and Storage
app.post('/presentation/:email', async (req, res) => {
    const { email } = req.params;
    const { topic, tone, pages, description } = req.body;

    const prompt = `Create a presentation outline on "${topic}" with a ${tone} tone. The presentation should have ${pages} pages. Here's a brief description: ${description}. Avoid using *** these. Please return the result as a JSON array where each object represents a slide with 'title' and 'content' properties.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();

        // // Strip Markdown syntax and parse JSON
        // const cleanedText = stripMarkdown(text);
        // const slides = JSON.parse(cleanedText);
        const cleanedText = text
            .replace(/```(?:json)?|```|“|”|‘|’/g, '') // Removes backticks and all curly quotes
            .replace(/\\n/g, '') // Removes newline escape sequences
            .replace(/\\+/g, '') // Removes any stray backslashes
            .trim();

        console.log("Cleaned Text:", cleanedText);

        const presentationData = {
            email,
            topic,
            tone,
            pages,
            description,
            slides,
            createdAt: new Date()
        };

        const insertResult = await presentationCollection.insertOne(presentationData);
        res.status(201).send({ message: "Presentation created successfully", id: insertResult.insertedId });
    } catch (error) {
        console.error("Error generating or storing presentation:", error);
        res.status(500).send({ message: "Error creating presentation", error: error.toString() });
    }
});


// Fetch Presentations
app.get('/presentation/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const presentations = await presentationCollection.find({ email }).toArray();
        res.send(presentations);
    } catch (error) {
        console.error("Error fetching presentations:", error);
        res.status(500).send({ message: "Error fetching presentations" });
    }
});

//Course Module
app.post('/module', async (req, res) => {
    const { email, name } = req.body;

    const prompt = `Generate a course module outline on "${name}".
    1. Divide the module into five or six of chapters.
    2. Each chapter should include:
       - 'title': For Chapter 1, avoid titles like "Table of Content" and start with foundational concepts .
       - 'content': A comprehensive description of the chapter topic, aiming for around 300-400 words.
       - 'example': 2 or three real life examples.
       - 'teacherScript': A short narrative describing how a teacher would explain or teach the chapter material to students, with examples.
       - 'mcqs': An array of 2 multiple-choice questions (MCQs), each with:
           - 'question': The question text.
           - 'options': An array of four options labeled a) , b) , c) , and d).
           - 'answer': The correct answer as a single character (e.g., 'a', 'b', 'c', or 'd').
    3. At the end of the module, create an "All MCQs" section, 10 new randomly MCQs from the module title.
       - Each MCQ should follow the same format with 'question', 'options', 'answer', and 'points' fields.
    Return the result as a valid JSON array where:
    - Each chapter is represented as an object with:
       - 'title': Title of the chapter.
       - 'content': Brief outline of the chapter.
       - 'teacherScript': Narrative describing how a teacher might teach the chapter content with examples as needed.
       - 'mcqs': An array of 5 MCQ objects.
    - The final object should be titled "All MCQs" and 10 new randomly MCQs from the module title.`;




    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();

        console.log("Raw Text:", text); // Debugging raw output

        // Clean the response text to ensure it's valid JSON
        const cleanedText = text
            .replace(/```(?:json)?|```|“|”|‘|’/g, '') // Removes backticks and all curly quotes
            .replace(/\\n/g, '') // Removes newline escape sequences
            .replace(/\\+/g, '') // Removes any stray backslashes
            .trim();

        console.log("Cleaned Text:", cleanedText);

        let chapters;
        try {
            if (cleanedText.trim().length === 0) {
                throw new Error("Empty response from model");
            }

            chapters = JSON.parse(cleanedText);
        } catch (parseError) {
            console.error("JSON Parsing Error:", parseError);
            console.error("Cleaned Text during error:", cleanedText);
            return res.status(500).send({ message: "Error parsing module response", error: parseError.toString() });
        }

        const moduleData = {
            email,
            name,
            chapters,
            createdAt: new Date()
        };

        const insertResult = await moduleCollection.insertOne(moduleData);
        res.status(201).send({ message: "Module created successfully", id: insertResult.insertedId });
    } catch (error) {
        console.error("Error generating or storing module:", error);
        res.status(500).send({ message: "Error creating module", error: error.toString() });
    }
});


// Fetch Modules (unchanged)
app.get('/module/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const modules = await moduleCollection.find({ email }).toArray();
        res.send(modules);
    } catch (error) {
        console.error("Error fetching modules:", error);
        res.status(500).send({ message: "Error fetching modules" });
    }
});

// Fetch a single module (unchanged)
app.get('/specificModule/:id/:email', async (req, res) => {
    try {
        const module = await moduleCollection.findOne({ _id: new ObjectId(req.params.id), email: req.params.email });
        if (!module) {
            return res.status(404).send({ message: "Module not found" });
        }
        res.send(module);
    } catch (error) {
        console.error("Error fetching module:", error);
        res.status(500).send({ message: "Error fetching module" });
    }
});


// patch a single module 
app.patch('/specificModule/:id/:email', async (req, res) => {
    try {
        const module = await moduleCollection.findOne({ _id: new ObjectId(req.params.id), email: req.params.email });

        if (!module) {
            return res.status(404).send({ message: "Module not found" });
        }
        const currentDate = new Date();

        const updateCourseStart = {
            $set: {
                courseStartedAt: currentDate
            },
        };

        const result = await moduleCollection.updateOne({ _id: new ObjectId(req.params.id), email: req.params.email }, updateCourseStart);

        res.status(200).send({ message: "Course Started" });
    } catch (error) {
        console.error("Error fetching Course:", error);
        res.status(500).send({ message: "Error fetching Course" });
    }
});

app.patch('/moduleProgress/:id/:email/:index', async (req, res) => {
    const submission = req.body;
    try {
        const { id, email, index } = req.params;
        const chapterIndex = parseInt(index, 10);

        if (isNaN(chapterIndex)) {
            return res.status(400).send({ message: "Invalid chapter index" });
        }

        const module = await moduleCollection.findOne({
            _id: new ObjectId(id),
            email: email
        });

        if (!module) {
            return res.status(404).send({ message: "Module not found" });
        }

        const currentDate = new Date();

        // Update the specific chapter in the array
        const updateQuery = {
            $set: {
                [`chapters.${chapterIndex}.chapterEndAt`]: currentDate, // Using dot notation to target specific chapter
                [`chapters.${chapterIndex}.submission`]: submission // Using dot notation to target specific chapter
            },
        };

        const result = await moduleCollection.updateOne(
            { _id: new ObjectId(id), email: email },
            updateQuery
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Chapter not found or already updated" });
        }

        res.status(200).send({ message: "Chapter updated successfully", status: 200 });
    } catch (error) {
        console.error("Error updating chapter:", error);
        res.status(500).send({ message: "Error updating chapter" });
    }
});


// patch a moduleEnd module 
app.patch('/moduleEnd/:id/:email', async (req, res) => {
    try {
        const module = await moduleCollection.findOne({ _id: new ObjectId(req.params.id), email: req.params.email });

        if (!module) {
            return res.status(404).send({ message: "Module not found" });
        }
        const currentDate = new Date();

        const updateCourseEnd = {
            $set: {
                courseEndAt: currentDate
            },
        };

        const result = await moduleCollection.updateOne({ _id: new ObjectId(req.params.id), email: req.params.email }, updateCourseEnd);

        res.status(200).send({ message: "Course Ended" });
    } catch (error) {
        console.error("Error fetching Course:", error);
        res.status(500).send({ message: "Error fetching Course" });
    }
});

app.get('/certificate/:id/:email', async (req, res) => {
    try {
        const module = await moduleCollection.findOne({ _id: new ObjectId(req.params.id), email: req.params.email });
        if (!module) {
            return res.status(404).send({ message: "Certificate not found" });
        }
        res.send(module);
    } catch (error) {
        console.error("Error fetching Certificate:", error);
        res.status(500).send({ message: "Error fetching Certificate" });
    }
});

// Main chatbot endpoint
app.post('/chatbot/email', async (req, res) => {
    try {
        const { email, query } = req.body;

        // Validate input
        if (!email || !query) {
            return res.status(400).send('Email and query are required');
        }

        // Generate AI response using Gemini
        const result = await model.generateContent(
            `You are an expert AI Professor. Provide a comprehensive, educational, and scholarly response to the following educational question: ${query}. 
            
            Guidelines:
            - Use an academic tone
            - Provide clear, structured explanation
            - Include relevant context and examples
            - Break down complex concepts
            - Cite general academic principles where applicable`
        );

        // Ensure response is correctly extracted
        let response = result.response.text();
        
        // Log raw response for debugging
        console.log("Raw AI Response:", response);

        // Remove unwanted ** and trim whitespace
        response = response.replace(/\*\*/g, '').trim();

        // Save conversation
        await conversations.insertOne({
            email,
            query,
            response,
            timestamp: new Date()
        });

        // Send cleaned response
        res.send(response);

    } catch (error) {
        console.error('Please Try Again', error);
        res.status(500).send('Failed to process request. Please Try Again!');
    }
});



// Retrieve conversations for a specific email
app.get('/chatbot/conversations/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const userConversations = await conversations
            .find({ email })
            .sort({ timestamp: 1 }) // Sort in ascending order
            .limit(50) // Optional: limit to prevent very long lists
            .toArray();

        res.json(userConversations);
    } catch (error) {
        console.error('Conversations Retrieval Error:', error);
        res.status(500).json({ error: 'Failed to retrieve conversations' });
    }
});


//Root Directory of Server
app.get('/', (req, res) => {
    res.send('Quick Edu Live Server is Running!!!');
});

// 404 Route of Server
app.all('*', (req, res) => res.send({
    status: 404,
    message: `Route Not Found!`
}));

app.listen(port, () => {
    console.log(`Quick Edu Live Server is Running on PORT : ${port}`);
});