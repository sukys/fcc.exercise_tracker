/*
 * Config
 */
const express = require('express');
const app = express();
const bodyParser = require('body-parser')
const cors = require('cors');

require('dotenv').config();
app.use(cors());
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


/*
 * Database
 */
const mongoose = require('mongoose');

mongoose.connect(
  process.env.MLAB_URI || 'mongodb://localhost/exercise-track', 
  {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true 
  });

const connection = mongoose.connection;
connection.once('open', () => {
  console.log("MongoDB database connection established successfully");
});


/*
 * Use public for CSS
 */
app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


/*
 * Model
 */
const User = require('./user.model');


/*
 * Endpoints
 */

// Create user by posting to /api/exercise/new-user 
// Return an object with username and _id.
app.post('/api/exercise/new-user', (req, res) => {
  const username = req.body.username;
  const newUser = new User({username: username});
  
  newUser.save()
    .then(user => res.json({username: user.username, _id: user.id}))
    .catch(err => res.status(400).json('Error: ' + err))
});


// Get users array by getting api/exercise/users
app.get('/api/exercise/users', (req, res) => {
  User.find()
    .then(users => res.json(users))
    .catch(err => res.status(400).json('Error: ' + err));
});


// Add exercise to any user by posting userId(_id), description, duration, and optionally date to /api/exercise/add. 
// If no date supplied, use current date. 
// Return user object with the exercise fields added.
app.post('/api/exercise/add', (req, res) => {
  const newExercise = {
    description: req.body.description, 
    duration: req.body.duration, 
    date: req.body.date ? new Date(req.body.date).toDateString() : new Date().toDateString()
  };
  
  User.findByIdAndUpdate(req.body.userId, {$push: { log:  newExercise}}, {new: true}).exec()
    .then( user => res.json({
      username: user.username,
      _id: user._id,
      description:  newExercise.description,
      duration: parseInt( newExercise.duration),
      date:  newExercise.date
    }))
    .catch( err => res.json(err) );
});


// Retrieve full exercise log of any user by getting /api/exercise/log with a parameter of userId(_id). 
// Return user object with added array log and count (total exercise count).
// Retrieve part of the log of any user by also passing along optional parameters of from & to or limit.
app.get('/api/exercise/log'/*?{userId}[&from][&to][&limit]*/, (req, res) => {
  User.findById(req.query.userId).exec()
  .then( user => {
    let newLog = user.log;
    
    if (req.query.from) {
      newLog = newLog.filter(x => {
        return x.date.getTime() > new Date(req.query.from).getTime(); 
      });
    }
    
    if (req.query.to) {
      newLog = newLog.filter(x => {
        return x.date.getTime() < new Date(req.query.to).getTime();
      });
    }
      
    if (req.query.limit) {
      newLog = newLog.slice(0, req.query.limit > newLog.length ? newLog.length : req.query.limit);
    }

    user.log = newLog;
    let temp = user.toJSON();
    temp['count'] = newLog.length;

    return temp;
  })
  .then( result => res.json(result))
  .catch(err => res.json(err));
    
});



/*
 * Not found middleware
 */
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})


/*
 * Error Handling middleware
 */
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})


/*
 * App status
 */
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})