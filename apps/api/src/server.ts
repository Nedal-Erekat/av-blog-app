import 'dotenv/config';
import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});
