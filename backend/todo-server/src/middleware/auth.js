import dotenv from "dotenv";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import * as dbUser from "../database/users.js";
import * as dbToken from "../database/tokens.js";

dotenv.config();

/* This is the middleware used to verify the token sent in the request
    to access a private endpoint 
*/
const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]; // get the header authorization (if exists)
  const token = authHeader && authHeader.split(" ")[1]; // get the token

  if (!token) {
    return res.status(403).send("A token is required for authentication");
  }
  try {
    const decoded = jwt.verify(token, process.env.SECRET_TOKEN);
    req.decoded = decoded;
  } catch (err) {
    return res.status(401).send("Invalid Token");
  }
  return next();
};

/* function triggered when user logs in */
const userLogin = async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({
      status: "error",
      error: "Request missing email or password",
    });
  }

  const user = await dbUser.getUserByUsername(username); // check if the user exists
  if (user) {
    // user already exists
    const validPassword = await bcrypt.compare(
      // check if the password is correct
      password, // input password
      user.password
    );
    if (validPassword) {
      // if the password is valid generate the tokens (access and refresh)
      const token = generateAccessToken(user.username, user.email);
      req.token = token;
      const refreshToken = generateRefreshToken(user.username, user.email);
      // enrich the "req" with this values
      req.refreshToken = refreshToken;
      // * save the refreshToken in the cookie so it's not exposed to frontend js
      req.userid = user.id;
      req.content = {
        user: user.username,
        email: user.email,
      };

      // * save in the DB the user's access and refresh token
      console.log(
        `\n*******\nRefreshToken to save: ${refreshToken}\n*********\n`
      );
      let tokenobj = {
        userid: user.id,
        refreshToken,
        creationDate: Date.now(),
      };
      // check if a refreshToken for this user already exists => in this case, remove it and store the new generated refreshToken
      let userToken = await dbToken.getTokenByUserid(user.id);
      if (userToken) await dbToken.deleteTokenByUserid(user.id);
      // save the new refreshToken in DB
      await dbToken.createToken(tokenobj);
      return next();
    } else {
      res.status(400).json({ error: "Invalid Password", password: password });
    }
  } else {
    // sends back imediately a response
    res.status(401).json({ error: "User not found" });
  }
};

/* Function that generates the Access Token with expiration= 2 minutes starting from the user's email, username and the SECRET_TOKEN*/
function generateAccessToken(username, email) {
  return jwt.sign({ user: username, email: email }, process.env.SECRET_TOKEN, {
    expiresIn: "2m",
  });
}

/* Function that generates the Refresh Token with expiration= 30 days minutes starting from the user's email, username and the SECRET_RTOKEN*/
function generateRefreshToken(username, email) {
  return jwt.sign({ user: username, email: email }, process.env.SECRET_RTOKEN, {
    expiresIn: "30d",
  });
}

/* Function triggered when new users sign up to the system */
const verifySignUp = async (req, res, next) => {
  try {
    // check if both username and mail are provided
    const { username, email } = req.body;
    console.log(`username: ${username}  mail: ${email}`);
    if (!username || !email) {
      return res.status(400).json({
        status: "error",
        error: "Request missing email or password",
      });
    }
    // check if the either the username or the email are already used
    let user = await dbUser.getUserByUsername(username);
    console.log(`user found by username: ${JSON.stringify(user)}`);
    if (user) {
      // username already used
      return res.status(400).send({
        message: "Username is already in use!",
      });
    }
    user = await dbUser.getUserByMail(email);
    console.log(`user found by email: ${JSON.stringify(user)}`);
    if (user) {
      return res.status(400).send({
        message: "Email is already in use!",
      });
    }

    next();
  } catch (error) {
    return res.status(500).send({
      message: "Unable to validate Username!",
      error: error,
    });
  }
};

const encryptPassword = async (req, res, next) => {
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash(req.body.password, salt);
  req.bcryptPassword = password;
  // generate tokens
  const token = generateAccessToken(req.body.username, req.body.email);
  req.token = token;
  const refreshToken = generateRefreshToken(req.body.username, req.body.email);
  // enrich the "req"
  req.refreshToken = refreshToken;
  // set the user id in the request object
  req.userid = uuidv4();
  req.content = {
    user: req.body.username,
    email: req.body.email,
  };
  next();
};

// get the access token starting from the refreshToken
const tokens = async (req, res) => {
  // check with optional chaining if the refreshToken exists as a cookie in the req
  /*if (req.cookies?.refreshToken) {
    console.log(
      `||||||||||||||||\n RefreshToken exists as cookie: ${req.cookies.refreshToken}`
    );
    // Destructuring refreshToken from cookie
    const { refreshToken } = req.cookies;
  */

  /* since I cannot figured out why cookies didn't worked with Docker, the refresh token is retrieved by the LocalStorage */
  let { refreshToken } = req.body;
  if (refreshToken) {
    console.log(`RefreshToken sent: ${refreshToken}`);
    // from the "tokens" table, get the userID
    let { userid } = await dbToken.getUseridByToken(refreshToken);
    console.log(`UserID found: ${JSON.stringify(userid)}`);
    // from the "users" table, get the user's information since the username and the mail are used to sign the accessToken
    let { username, email } = await dbUser.getUserById(userid);
    // Verifying refresh token
    jwt.verify(refreshToken, process.env.SECRET_RTOKEN, (err, decoded) => {
      if (err) {
        // Wrong Refesh Token
        return res.status(406).json({ message: "Unauthorized" });
      } else {
        // the refreshToken is correct => generate new accessToken
        const accessToken = generateAccessToken(username, email);
        console.log(
          `\n New accessToken generated: ${JSON.stringify(accessToken)}`
        );
        return res.json({ accessToken });
      }
    });
  } else {
    console.log(`\nRefreshToken NOT FOUND: ${refreshToken}`);
    return res.status(406).json({ message: "Unauthorized" });
  }
};

// delete the refreshToken associated to the userID
const deleteToken = async (req, resp) => {
  const { userid } = req.params;
  let result = await dbToken.deleteTokenByUserid(userid);
  resp.json(result);
};

export {
  userLogin,
  verifyToken,
  verifySignUp,
  encryptPassword,
  tokens,
  deleteToken,
};
