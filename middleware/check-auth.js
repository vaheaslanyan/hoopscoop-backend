const jwt = require("jsonwebtoken"); //will use it to verify the token here with the token created in users-controller

const HttpError = require("../models/http-error");

module.exports = (req, res, next) => {
  if (req.method === "OPTIONS") {
    //every time the browser sends any request besides get it will first send an OPTIONS request to check if the request will be permited, this is a required adjustment to ensure the OPTIONS request is not blocked before we can move further
    return next();
  }
  try {
    const token = req.headers.authorization.split(" ")[1]; // extracting token from the incoming request, 'headers' is provided by express, its a key-value property, we allowed the attachment of authorization header in our app.js. We split and select 1 because the authorization property ocmes back as something like 'Bearer TOKEN' so we want to split it from the space and select the second part.
    if (!token) {
      throw new Error("Authentication failed 1");
    }
    const decodedToken = jwt.verify(token, process.env.TOKEN_KEY); // verify does not return a boolean but whatever we appended to the token such as userId and email
    req.userData = { userId: decodedToken.userId }; //adding data to req object
    next();
  } catch (err) {
    const error = new HttpError("Authentication failed", 401);
    return next(error);
  }
};
