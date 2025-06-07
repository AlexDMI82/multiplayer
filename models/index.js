// models/index.js
const User = require('./user');
const Stats = require('./stats');
const Inventory = require('./inventory');
const PlayerLevel = require('./playerLevel');
const Bot = require('./bot');

module.exports = {
    User,
    Stats,
    Inventory,
    PlayerLevel,
    Bot
};