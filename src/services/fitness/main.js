require('dotenv').config()
const {insertEntry, getFiltered} = require("../../db/dbconfig");
const hashString = require('../../utils/hashing')
const {getToday, minusOneMonth, secondsUntilEndOfDay} = require("../../utils/datetime");
const Cache = require('../../utils/cache')

const COLLECTION = process.env.FITNESS_COLLECTION;

const cache = new Cache();

const getWorkouts = function(body) {
    return body.data.workouts;
}

const cleanWorkout = function(workout) {
    return {
        maxHeartRate: workout.maxHeartRate,
        avgHeartRate: workout.avgHeartRate,
        totalEnergy: workout.totalEnergy,
        activeEnergy: workout.activeEnergy,
        start: workout.start,
        end: workout.end,
        name: workout.name,
        intensity: workout.intensity,
    }
}

/**
 * If workouts are tracked by multiple apps, they may appear multiple times.
 * The start and end times will be the same, thus we can deduplicate them by
 * only keeping one instance.
 * */
const deduplicate = function(workouts) {
    const encountered = {}
    const out = []

    for (const w of workouts) {
        const key = w.start.toString() + w.end.toString()
        if (!(key in encountered)) {
            encountered[key] = true
            out.push(w)
        }
    }
    return out
}

const write = async function (rawWorkouts) {
    const clean = getWorkouts(rawWorkouts).map(cleanWorkout)
    deduplicate(clean).map(w => insertEntry(w, COLLECTION))
}

/**
 * Read fitness entries from the db
 * */
const read = async function() {

    const key = hashString(getToday().toString())
    if (cache.has(key)) return cache.get(key)

    // Date from one month ago
    const date = minusOneMonth(new Date())

    // all entries last month
    const filter = {"start": {$gte: date.toISOString()}}
    const workouts = await getFiltered(filter, "start", COLLECTION);

    const ttl = secondsUntilEndOfDay()
    cache.set(key, workouts, ttl)
    return workouts
}

module.exports = {
    read: read,
    write: write
};
