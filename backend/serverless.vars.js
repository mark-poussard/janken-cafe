const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const BASE_ALLOWED_ORIGINS = [
  'https://mark-poussard.github.io'
];

module.exports = () => {
  const stage = process.env.SLS_STAGE || 'dev';

  let finalAllowedOrigins = [...BASE_ALLOWED_ORIGINS];

  console.log(`[serverless.vars.js] Determining allowed origins for stage: ${stage}`);

  if (stage !== 'prod') {
    const devConfigPath = path.join(__dirname, `config.${stage}.yml`);
    try {
      if (fs.existsSync(devConfigPath)) {
        const stageConfig = yaml.load(fs.readFileSync(devConfigPath, 'utf8'));
        if (stageConfig && Array.isArray(stageConfig.allowedOrigins)) {
          console.log(`[serverless.vars.js] Found ${stage} origins: ${stageConfig.allowedOrigins.join(', ')}`);
          // Merge and remove duplicates
          finalAllowedOrigins = [...new Set([...finalAllowedOrigins, ...stageConfig.allowedOrigins])];
        } else {
           console.log(`[serverless.vars.js] config.${stage}.yml found, but 'allowedOrigins' key is missing or not an array.`);
        }
      } else {
        console.log(`[serverless.vars.js] config.${stage}.yml not found for ${stage} stage. Using only base origins.`);
      }
    } catch (e) {
      console.error(`[serverless.vars.js] Error reading or parsing config.${stage}.yml:`, e);
    }
  }
  const allowedOriginsString = finalAllowedOrigins.join(',');

  console.log(`[serverless.vars.js] Final ALLOWED_ORIGINS for stage ${stage}: ${allowedOriginsString}`);
  
  return {
    allowedOrigins: allowedOriginsString,
  };
};