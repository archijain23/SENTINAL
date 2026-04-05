/**
 * validate(schema)
 * Express middleware factory that validates req.body against a Joi schema.
 *
 * @param {Object} schema - A Joi schema object
 * @returns Express middleware function
 *
 * Example:
 *   const Joi = require('joi');
 *   const { validate } = require('sentinal-middleware');
 *
 *   const schema = Joi.object({ ip: Joi.string().ip().required() });
 *   router.post('/report', validate(schema), controller);
 */
const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false });
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details.map(d => d.message).join(', '),
      code: 'VALIDATION_ERROR'
    });
  }
  next();
};

module.exports = validate;
