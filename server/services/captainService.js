const { Captain, Team } = require('../models');
const ApiError = require('../utils/ApiError');
const { runInTransaction } = require('../utils/transaction');
const { assignCaptain } = require('./teamService');

async function listCaptains() {
  return Captain.find().sort({ name: 1 }).populate('team', 'name logo color');
}

async function getCaptain(id) {
  const captain = await Captain.findById(id).populate('team', 'name logo color');
  if (!captain) throw ApiError.notFound('Captain not found');
  return captain;
}

async function createCaptain(data) {
  const captain = await runInTransaction(async (session) => {
    const [created] = await Captain.create(
      [{ name: data.name, phone: data.phone, photo: data.photo || '', team: null }],
      session ? { session } : {}
    );
    if (data.team) await assignCaptain(data.team, created._id, session);
    return created;
  });
  return getCaptain(captain._id);
}

async function updateCaptain(id, data) {
  const captain = await runInTransaction(async (session) => {
    const doc = await Captain.findById(id).session(session);
    if (!doc) throw ApiError.notFound('Captain not found');
    ['name', 'phone', 'photo'].forEach((f) => {
      if (data[f] !== undefined) doc[f] = data[f];
    });
    await doc.save(session ? { session } : {});

    if (data.team !== undefined) {
      if (data.team) {
        await assignCaptain(data.team, doc._id, session);
      } else if (doc.team) {
        await assignCaptain(doc.team, null, session);
      }
    }
    return doc;
  });
  return getCaptain(captain._id);
}

async function deleteCaptain(id) {
  const captain = await Captain.findById(id);
  if (!captain) throw ApiError.notFound('Captain not found');
  await runInTransaction(async (session) => {
    if (captain.team) await Team.updateOne({ _id: captain.team }, { $set: { captain: null } }).session(session);
    await Captain.deleteOne({ _id: captain._id }).session(session);
  });
  return captain;
}

module.exports = { listCaptains, getCaptain, createCaptain, updateCaptain, deleteCaptain };
