const GenericParser = require('./generic');
const url = require('url');

module.exports = class m3u extends GenericParser {

    constructor(httpLib, hlsstream, options) {
        super(httpLib, hlsstream, options);
    }

    _write(chunk) {
        let hasNoNewSegments = true;

        this.currentSources = 0, this.completed = 0;
        const playlist = chunk.toString().trim().split('\n');
        this.hlsstream.emit('status', 'Parsing through playlist');

        for (let index = 0; index < playlist.length; index++) {
            if (this._parse(playlist[index]) == false) break;
            if (playlist[index][0] !== '#') {
                if (Object.values(this.chunks).every(segment => segment.link == url.resolve(this.path, playlist[index])) == true) {
                    hasNoNewSegments = false;
                }
            }
        }
        
        if (hasNoNewSegments == true || this.live == true) {
            this.refreshAttempts++;
            this._fetchPlaylist();
        } else {
            this.refreshAttempts = 0;
        }
        this.hlsstream.emit('status', 'Playlist parsing complete');
    }

    _parse(line) {
        let value = line;
        let info = null;

        if(line[0] == '#' && line.indexOf(':') != -1) {
            value = line.split(':')[0];
            info = line.split(':')[1];
        }

        switch(value) {
            case('#EXT-X-MEDIA-SEQUENCE'):
                if(info < this.sequence) return false;
                this.sequence = parseInt(info);
                break;
            case('#EXTINF'):
                this.duration += parseFloat(info.split(',')[0]);
                break;
            case('#EXT-X-ENDLIST'):
                this.live = false;
                break;
            default:
                if(value[0] != '#') {
                    if(!Object.values(this.chunks).some(x => x.link == url.resolve(this.path, value))) {
                        this.currentSources++;
                        this._download(url.resolve(this.path, value), this.sources++);
                    }
                }
                break;
        }
    }

};