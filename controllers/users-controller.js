const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const User = require("../models/user");

const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password"); //will find all users and return all properties except the password
  } catch (err) {
    const error = new HttpError(
      "Fetching users failed, please try again later",
      500
    );
    return next(error);
  }
  res.json({ users: users.map(user => user.toObject({ getters: true })) });
};

const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs, please check your data", 422));
  }

  const { name, email, password } = req.body; //make sure the app uses https in order to keep all the infromation secure

  let existingUser;
  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Signup failed. Please try again later", 500);
    return next(error);
  }

  if (existingUser) {
    const error = new HttpError(
      "User exists already, please login or use a different email address",
      422
    );
    return next(error);
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12); // 12 is the salt, this number is a good middle ground as it cannot be reverse engineered but still doesn't take too long to generate
  } catch (err) {
    const error = new HttpError("Could not create user, please try again", 500);
  }

  const createdUser = new User({
    name,
    email,
    image: req.file.url,
    password: hashedPassword,
    places: []
  });

  try {
    await createdUser.save();
  } catch (err) {
    const error = new HttpError("Signup failed, please try again", 500);
    return next(error);
  }

  //creating a token
  let token;
  try {
    token = jwt.sign(
      {
        userId: createdUser.id,
        email: createdUser.email
      },
      process.env.TOKEN_KEY, //make sure to change this to enviromental variable
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("Signup failed, please try again later", 500);
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existingUser;

  try {
    existingUser = await User.findOne({ email: email });
  } catch (err) {
    const error = new HttpError("Login failed. Please try again later", 500);
    return next(error);
  }

  if (!existingUser) {
    const error = new HttpError(
      "Login failed. Please check your credentials and try again ",
      401
    );
    return next(error);
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existingUser.password);
  } catch (err) {
    const error = new HttpError("Could not log you in, please try again", 500);
    return next(error);
  }

  if (!isValidPassword) {
    const error = new HttpError(
      "Invalid credentials, could not log you in.",
      403
    );
    return next(error);
  }

  //creating a token
  let token;
  try {
    token = jwt.sign(
      {
        userId: existingUser.id,
        email: existingUser.email
      },
      process.env.TOKEN_KEY, //make sure to change this to enviromental variable, must be the same as signup key
      { expiresIn: "1h" }
    );
  } catch (err) {
    const error = new HttpError("Login failed, please try again later", 500);
  }

  res.json({
    userId: existingUser.id,
    email: existingUser.email,
    token: token
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
