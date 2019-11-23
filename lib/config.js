const params = {
    mongoURL: process.env.MONGO_URL,
    mongoOpts: {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }    
}

module.exports.params = params