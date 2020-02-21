const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const fs = require("fs"); // built in node method that will allow us to delete a place's image when a place is deleted

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");

const getAllPlaces = async (req, res, next) => {
  let places;

  try {
    places = await Place.find().populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Fetching places failed, please try again later",
      500
    );
    return next(error);
  }

  if (!places || places.length === 0) {
    return next(
      new HttpError("Coudl not find a place with the provided user ID", 404)
    ); // return stops the code below from running
  }

  res.json({ places: places.map(place => place.toObject({ getters: true })) }); //have to use map as it is an array
};

//for get at /:pid
const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError("Something went wrong. Place not found", 500);
    return next(error);
  }

  if (!place) {
    // without the use of the model it would look like this:
    // const error = new Er("Could not find a place with the provided ID.");
    // error.code = 404;
    // next(error); // triggering the error handling middleware in app.js(if not wrking with async then can user 'throw error' instead)
    next(new HttpError("Could not find a place with the provided ID", 404));
  }

  res.json({ place: place.toObject({ getters: true }) }); // toObject will convert the it to a regular js ovject, and getters will convert _id to just id
};

// for get at /user/:uid
const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let places;

  try {
    places = await Place.find({ creator: userId });
  } catch (err) {
    const error = new HttpError(
      "Fetching places failed, please try again later",
      500
    );
    return next(error);
  }

  if (!places || places.length === 0) {
    return next(
      new HttpError("Coudl not find a place with the provided user ID", 404)
    ); // return stops the code below from running
  }

  res.json({ places: places.map(place => place.toObject({ getters: true })) }); //have to use map as it is an array
};

//for post at /
const createPlace = async (req, res, next) => {
  const error = validationResult(req); //started in places-routes with 'check'

  if (!error.isEmpty()) {
    console.log(error);
    return next(new HttpError("Invalid inputs, please check the data", 422));
  }

  const { title, description, address, creator } = req.body; //this desctructuring will get properties out of req.body and store it in constants which are then available in the function

  let fullLocation;

  try {
    fullLocation = await getCoordsForAddress(address);
  } catch (error) {
    console.log(error);
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address: fullLocation.address,
    location: fullLocation.coordinates,
    image: req.file.url, //extract the url to the file and store it in the db
    creator: req.userData.userId //this is an automatically extracted id from the token that we get from check-auth.js, its safer than pulling it straight from the front end as it cannot be faked
  });

  let user;
  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      "Creating place failed, please try again (1)",
      500
    );
    console.log(err);
    return next(error);
  }

  if (!user) {
    const error = new HttpError("User cannot be found", 404);
    return next(error);
  }

  console.log(user);

  //because we are working with transactions the automatic creation of collections in our db won't work so we have to make sure to pre-create the collection (in this case the places) in our db manually
  try {
    const sess = await mongoose.startSession(); //mongoose sessions make sure that all the steps within a transaction have to be successfull before the data is added to the db, otherwise it will just rollback the changes
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace); // this is not the regular push but a mongoose method that just establishes connections between different data through passing the objectId
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Creating place failed, please try again (2)",
      500
    );
    console.log(err);
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

const updatePlace = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    console.log(error);
    return next(new HttpError("Invalid inputs, please check the data", 422));
  }

  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong. Could not update place",
      500
    );
    return next(error);
  }

  //checking authorization
  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError(
      "You do not have permission to edit this place",
      401
    );
    return next(error);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong. Could not update place",
      500
    );

    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlace = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId).populate("creator"); //populate is a mongoose method that will pull the data and let us interact with it from a 'linked' object if there has been established a relationship in our models in this case the creator of the place
  } catch (err) {
    const error = new HttpError(
      "Something went wrong. Could not delete place",
      500
    );
    return next(error);
  }

  if (!place) {
    const error = HttpError("Place not found", 404);
    return next(error);
  }

  //checking authorization
  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError(
      "You do not have permission to delete this place",
      401
    );
    return next(error);
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await place.remove({ session: sess });
    place.creator.places.pull(place); //mongoose method
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong. Could not delete place",
      500
    );
    return next(error);
  }

  fs.unlink(imagePath, err => {
    console.log(err);
  });

  res.status(200).json({ message: "Deleted place " + placeId });
};

exports.getAllPlaces = getAllPlaces;
exports.getPlaceById = getPlaceById; //alternative for module.exports but when we want to export multiple
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
