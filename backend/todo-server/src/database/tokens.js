// File for CRUD operations against tokens table
import { connectedKnex as knex } from "./knex.js";

function createToken(token) {
  console.log(`adding ${token} to db`);
  return knex("tokens").insert(token);
}

function getTokens() {
  return knex("tokens").select("*");
}

function getTokenByUserid(userid) {
  // get the user with the given id
  return knex("tokens").where("userid", userid).first();
}

function getUseridByToken(token) {
  // get the user with the given id
  return knex("tokens").where("refreshToken", token).first();
}

function deleteTokenByUserid(userid) {
  // get the user with the given id
  return knex("tokens").where("userid", userid).del();
}

export {
  createToken,
  getTokens,
  getTokenByUserid,
  deleteTokenByUserid,
  getUseridByToken,
};
