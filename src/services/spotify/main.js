require('dotenv').config();
const request = require('request');
const {cache, refresh} = require("./auth");
const hashString = require("../../utils/hashing");
const {getToday, secondsUntilEndOfDay} = require("../../utils/datetime");
const retry = require("../../utils/retry");


const K_ACCESS_TOKEN = 'access-token'


const spotifyClient = async function(url) {

    const options = () => {
        return {
            url: url,
            headers: {'Authorization': 'Bearer ' + cache.get(K_ACCESS_TOKEN)},
            json: true
        }
    };

    // make the actual request
    return new Promise((resolve, reject) => {
        request.get(options(), async function (error, response, body) {
            if (error) return reject(error)
            if (response.statusCode === 204) return resolve({})

            let returnVal = body
            if (body.hasOwnProperty('error') && body.error.status === 401) {

                // refresh token
                await refresh();
                returnVal = await retry(options())
                resolve(returnVal)

            } else {
                resolve(returnVal)
            }
        })
    })
}

const getData = async function (url, ttl) {

    const key = hashString(getToday().toString() + url)

    if (cache.has(key)) return cache.get(key)

    const entry = await spotifyClient(url)
    cache.set(key, entry, ttl)
    return entry
}

const getTopArtists = function() {
    const url = 'https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=5'
    const ttl = secondsUntilEndOfDay()
    return getData(url, ttl)
}

const getTopTracks = function() {
    const url = 'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5'
    const ttl = secondsUntilEndOfDay()
    return getData(url, ttl)
}

const getRecentlyPlayed = function() {
    const url = 'https://api.spotify.com/v1/me/player/recently-played?limit=5'
    const ttl = 30
    return getData(url, ttl)
}

const getCurrentlyPlaying = async function() {

    const key = 'currently-playing'

    if (cache.has(key)) return cache.get(key)

    const url = 'https://api.spotify.com/v1/me/player/currently-playing?market=GB&additional_types=track%2Cepisode'
    const raw = await spotifyClient(url)
    const entry = {}

    if (Object.keys(raw).length === 0) {
        cache.set(key, {}, 30)
        return {}
    }

    entry['spotify_url'] = raw.item.external_urls.spotify
    entry['name'] = raw.item.name
    entry['is_playing'] = raw.is_playing

    // episode
    if (raw.currently_playing_type === 'episode') {
        entry['type'] = 'episode'
        entry['image'] = raw.item.images[0]
        entry['show'] = raw.item.show.name
    }

    // track
    else {
        entry['type'] = 'track'
        entry['artists'] = raw.item.artists.map(e => e.name)
        entry['image'] = raw.item.album.images[0]
        entry['popularity'] = raw.item.popularity
    }

    cache.set(key, entry, 30)

    return entry
}


module.exports = {
    getTopArtists,
    getTopTracks,
    getCurrentlyPlaying,
    getRecentlyPlayed
}
