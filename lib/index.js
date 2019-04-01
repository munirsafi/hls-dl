const stream = require('stream');
const url = require('url');
const http = require('http');
const https = require('https');
const fs = require('fs');

const m3u = require('./parsers/m3u');
const mpd = require('./parsers/mpd');

/**
 * @param {String} path Path to stream playlist
 * @param {Object} options Objects for configuring playlist capture
 * @returns {ReadableStream} Readable stream of the playlist
 */
const hlsdl = (path, options) => {
    if(path instanceof Object || path == '') throw Error('A path to an M3U or MPD stream was not provided. Please be sure to include a path to continue');

    const hlsstream = new stream.PassThrough();
    options = options || {};
    options.path = path;
    options.timeout = (options.timeout) ? options.timeout : 2500;
    options.livebuffer = (options.livebuffer) ? options.livebuffer : 20000;

    const host = url.parse(path);

    let httpLib = null;
    let parser = (options.parser) ? getParser(`.${options.parser}`) : getParser(path);

    (host.protocol === 'http:') ? httpLib = http : httpLib = https;
    if(host.protocol != 'http:' && host.protocol != 'https:' && host.protocol != 'file:') {
        throw new Error('No protocol was included in the path provided. Please ensure an http, https, or file protocol is selected.')
    }
    
    if(host.protocol === 'file:') {
        fs.readFile(host.path, (err, data) => {
            if(err) throw Error('The path to the file provided does not exist. Please check again.');
            let internalStream = new parser(httpLib, hlsstream, options);
            internalStream.write(data);
        });
    } else {
        const downloadPlaylist = (host) => {
            httpLib.get(host, (res) => {
                let internalStream = new parser(httpLib, hlsstream, options);
                let responseBody = '';

                if (res.statusCode >= 500 || res.statusCode < 200) throw Error(`The path provided returned a ${res.statusCode} status code. Please ensure the request resource is available for access before continuing.`);
                res.on('error', (err) => { console.log(err); downloadPlaylist(host) });

                if (res.statusCode === 200) {
                    res.on('data', chunk => {
                        responseBody += chunk;
                    });
                    res.on('end', () => {
                        internalStream.write(responseBody);
                    });
                } else {
                    res.on('data', chunk => console.log(chunk.toString()));
                }
            }).on('error', (err) => downloadPlaylist(host));
        }

        downloadPlaylist(host);
    }

    return hlsstream;
};

const getParser = (path) => {
    if(RegExp('.m3u').test(path)) return m3u;
    if(RegExp('.mpd').test(path)) return mpd;

    throw Error('No compatible HLS stream type detected. Please ensure you\'ve provided a direct link to an M3U or MPD stream.');
};

module.exports = hlsdl;