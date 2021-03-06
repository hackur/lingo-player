var http = require('http');
var fs = require('fs');

exports.download = function(url, dest, cb) {
    // check if file exists
    fs.stat(dest, function(err, stat) {
        if(err == null) {
            // file exists already, just return
            cb();
        } else {
            var file = fs.createWriteStream(dest);
            var request = http.get(url, function(response) {
                response.pipe(file);
                file.on('finish', function() {
                    file.close(cb);  // close() is async, call cb after close completes.
                });
            }).on('error', function(err) { // Handle errors
                fs.unlink(dest); // Delete the file async. (But we don't check the result)
                if (cb) cb(err.message);
            });
        }
    });
};

var compactSubtitleUrls = function(urls, limit){
    var final_urls = [];
    for (var u in urls) {
        if (final_urls.length >= limit) break;
        var url = urls[u];
        if (final_urls.indexOf(url) == -1) {
            final_urls.push(url);
        }
    }
    return final_urls;
};

exports.searchSubsExtendByImdbID = function(language, moviePath, extensions, limit, cb){ // todo: more error handling
    var OS = require('opensubtitles-api');
    var os = new OS('Lingo Player');
    os.api.LogIn('','','en','Lingo Player').then(function(result){
        var token = result.token;
        // calculate movie hash
        os.extractInfo(moviePath).then(function(info){
            var moviebytesize = info.moviebytesize;
            var moviehash = info.moviehash;
            // get movie imdb id (for more results)
            os.api.CheckMovieHash(token, [moviehash]).then(function(info2){
                var imdbid;
                if(info2.data && info2.data[moviehash] && info2.data[moviehash].MovieImdbID) {
                    imdbid = info2.data[moviehash].MovieImdbID;
                }
                // search by both hash and imdbid
                os.api.SearchSubtitles(token, [{
                    moviehash: moviehash,
                    moviebytesize: moviebytesize,
                    sublanguageid: language
                },{
                    sublanguageid: language,
                    imdbid: imdbid
                }], {limit: 20}).then(function(results){
                    if(results.data && results.data.length){
                        var ret = [];
                        for (var i in results.data){
                            var sub = results.data[i];
                            // if the format is supported
                            if(extensions.indexOf(sub.SubFormat.toLowerCase()) > -1){
                                // add the link
                                ret.push(sub.SubDownloadLink.replace('.gz', '.'+sub.SubFormat));
                            }
                        }
                        cb(compactSubtitleUrls(ret, limit));
                    } else {
                        cb([]);
                    }
                });
            });
        });
    });
};