const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for JSON logs
const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Custom format for console logs (more readable)
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: {
        service: 'ollama-chatbot-backend',
        instance: process.env.HOSTNAME || 'local',
        node_env: process.env.NODE_ENV || 'development'
    },
    transports: [
        // Console output (readable format)
        new winston.transports.Console({
            format: consoleFormat
        }),
        
        // All logs (JSON format for ELK)
        new winston.transports.File({
            filename: path.join(logsDir, 'app-combined.log'),
            format: jsonFormat,
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),
        
        // Error logs (separate file)
        new winston.transports.File({
            filename: path.join(logsDir, 'app-error.log'),
            level: 'error',
            format: jsonFormat,
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    ]
});

// Helper function to create child logger with additional context
logger.child = (meta) => {
    return logger.child(meta);
};

// Helper to log HTTP requests
logger.logRequest = (req, res, duration) => {
    logger.info('HTTP Request', {
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        duration_ms: duration,
        ip: req.ip,
        user_agent: req.get('user-agent'),
        request_id: req.id
    });
};

// Helper to log database operations
logger.logDbOperation = (operation, collection, duration, success = true, error = null) => {
    const logData = {
        db_operation: operation,
        collection: collection,
        duration_ms: duration,
        success: success
    };
    
    if (error) {
        logger.error('Database operation failed', { ...logData, error: error.message });
    } else {
        logger.info('Database operation', logData);
    }
};

// Helper to log Ollama API calls
logger.logOllamaCall = (model, chatId, messageLength, duration, success = true, error = null) => {
    const logData = {
        ollama_call: true,
        model: model,
        chat_id: chatId?.toString(),
        message_length: messageLength,
        duration_ms: duration,
        success: success
    };
    
    if (error) {
        logger.error('Ollama API call failed', { ...logData, error: error.message });
    } else {
        logger.info('Ollama API call', logData);
    }
};

// Helper to log Elasticsearch operations
logger.logElasticsearch = (operation, index, success = true, error = null) => {
    const logData = {
        es_operation: operation,
        index: index,
        success: success
    };
    
    if (error) {
        logger.warn('Elasticsearch operation failed', { ...logData, error: error.message });
    } else {
        logger.info('Elasticsearch operation', logData);
    }
};

// Middleware for Express to log all requests
logger.expressMiddleware = () => {
    return (req, res, next) => {
        // Generate unique request ID
        req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        req.startTime = Date.now();
        
        // Log incoming request
        logger.info('Incoming request', {
            request_id: req.id,
            method: req.method,
            path: req.path,
            query: req.query,
            ip: req.ip,
            user_agent: req.get('user-agent')
        });
        
        // Log response when finished
        res.on('finish', () => {
            const duration = Date.now() - req.startTime;
            logger.logRequest(req, res, duration);
        });
        
        next();
    };
};

module.exports = logger;