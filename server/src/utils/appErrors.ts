export class AppError extends Error {
    statusCode: number;
    errors?: { field: string; message: string }[] | string;
    isOperational: boolean;

    constructor(message: string, statusCode: number, errors?: { field: string; message: string }[] | string,isOperational: boolean = true,) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.errors = errors;

        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, errors?: { field: string; message: string }[]) {
        super(message, 400, errors, true);
    }
}