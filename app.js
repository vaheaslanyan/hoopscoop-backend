require("dotenv").config();

const fs = require("fs"); // a node.js core module that allows us to interact with files
//const path = require("path"); // built-in module

const express = require("express"),
  bodyParser = require("body-parser"),
  mongoose = require("mongoose");

const placesRoutes = require("./routes/places-routes");
const usersRoutes = require("./routes/users-routes");
const HttpError = require("./models/http-error");

const app = express();

app.use(bodyParser.json());

//app.use("/uploads/images", express.static(path.join("uploads", "images"))); //granting access to files from front end by building a new path pointing to the folder

app.use((req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "*" //https://thehoopscoop-app.firebaseapp.com
  );
  res.setHeader("Set-Cookie", "HttpOnly;Secure;SameSite=Strict"); //sets header to responses in order to avoid the browser CORS security error, the second argument indicates which urls should be allowed (star meaning any url)
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization" //we set Content-Type and Authorization, the rest is automatically set by the browser
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
  next();
});

app.use("/api/places", placesRoutes);
app.use("/api/users", usersRoutes);

app.use((req, res, next) => {
  const error = new HttpError("Could not find this route", 404);
  throw error;
});

//this middleware will be only executed in case of an error
app.use((error, req, res, next) => {
  if (req.file) {
    //.file is a property added by multer and in this case we check if there is a file present while the error occured then we want to delete it
    fs.unlink(req.file.url, err => {
      //need to change path to url
      console.log(err);
    }); //delets the file
  }
  if (res.headerSent) {
    //checking if a response has been sent
    return next(error);
  }
  res.status(error.code || 500);
  res.json({ message: error.message || "An unknown error occured" });
});

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    app.listen(process.env.PORT || 5000, function() {
      //process.env.PORT gets the port from Heroku
      console.log("Server is running on port 5000");
    });
  })
  .catch(err => {
    console.log(err);
  });
