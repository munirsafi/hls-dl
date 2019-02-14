# hls-dl

###### [Getting Started](#getting-started) | [Usage](#usage) | [API](#api) | [Future](#future)

> hls-dl is a NodeJS module that provides the ability to download HTTP Live Stream playlists, particularly M3U/M3U8 and MPEG-DASH playlist files. hls-dl is capable of downloading media and master streams, as well as actively live streams.

##### Features

Capturing media from live streams is not always a straightforward task. hls-dl simplifies this process and provides the following features:

* Supports http, https, and file:// protocols
* Blazing fast speeds - **average of 1.5-4x** faster than other HTTP live-stream downloading modules
* Downloads M3U/M3U8 media stream playlists
* Provides stream object to easily retrieve output data
* Simplified stream events for additional insight


<!-- [START gettingstarted] -->

## Getting Started

### Install

To include hls-dl in your project, run the following command:

```bash
npm install hls-dl
```

or if you prefer using yarn:

```bash
yarn add hls-dl
```

<!-- [END gettingstarted] -->

<!-- [START usage] -->

## Usage

hls-dl provides a readable stream object to download any data returned from a M3U/M3U8 media playlist file. This data can be be written to a file easily using Node's `fs` module. A number of examples are provided below to demonstrate capture from playlists that are located in the file system as well as online.

**Example** - Downloading an m3u8 media playlist stream and piping to a writable stream

Save file as example.js

```js
const hlsdl = require('hls-dl');
const fs = require('fs');

const httpstream = hlsdl('https://example.com/path/to/your/m3u8/file.m3u8');
httpstream.pipe(fs.createWriteStream('save_file_https.mp4'));

// additionally, a playlist file in the file system can be loaded as well
const filestream = hlsdl('file:///User/name/path/to/your/m3u8/file.m3u8');
filestream.pipe(fs.createWriteStream('save_file_local.mp4'));
```

Then execute the script using

```bash
node example.js
```

hls-dl will download all segments and begin piping to the writable stream after segment downloads have completed. 

**Example** - Capturing events emitted from the stream

```js
const hlsdl = require('hls-dl');
const fs = require('fs');

const stream = hlsdl('https://example.com/path/to/your/m3u8/file.m3u8');
stream.pipe(fs.createWriteStream('save_file.mp4'));

stream.on('status', info => {
    // do something with info
    console.log(info);
});
```

Throughout the retrieval process, multiple events are emitted from the stream to indicate overall progression in the playlist capture. Additional events can be found in the [API](#api) section below. 

<!-- [END usage] -->

<!-- [START api] -->

## API

### Functions

#### hlsdl(path, [options])
- `path` <[String]> a path pointing to a **file**, **http**, or **https** link
- `options` <[Object]> configurable options for the stream to use
    - `parser` <[String]> Specifies which parser to use, either `m3u` or `mpd`
    - `timeout` <[Number]> Number of milliseconds to wait before considering a segment fetch as timed out
- returns <[Stream.Readable]> A readable stream that will output playlist segment data

This method will immediately begin capture of the specified playlist and return the readable stream

### Events

#### event: 'segment'

- `info` <[Object]> returns an object of information regarding a segment
    - `id` <[Number]> the segment's internal id
    - `url` <[String]> path to the segment's origin
    - `size` <[Number]> the size of the segment's buffer
    - `totalsegments` <[Number]> the total number of segments

Emitted when a new segment has been saved and pushed to the readable stream. Returns an object.

#### event: 'status'

- `status` <[String]> returns a string of information

Emitted throughout different points of the script being run including: parsing the playlist, downloading segments, download completion, pushing segments to the stream, and notifying playlist completion

#### event: 'issue'

- `issue` <[String]> returns a string of information

Emitted when an error or issue occurs, but does not break the script. Any point in which an issue is emitted, a self-fixing mechanism is triggered to resolve the issue.

<!-- [END api] -->

<!-- [START future] -->

## Future

### Current Tasks

Due to the package being actively developed, there are a number of items in the development backlog which are currently being worked on. A list of these features is provided below:

* MPD playlist download
* MPD live playlists

### Future Tasks

A number of features that would be nice to complete but are not considered a priority to develop are provided below. If there are any requests to complete these features sooner, they may be moved into the current iteration. These features are listed below:

- M3U master playlists
- M3U encrypted media streams

<!-- [END future] -->

[Number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[String]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[Stream.Readable]: https://nodejs.org/api/stream.html#stream_readable_streams "Readable Stream"