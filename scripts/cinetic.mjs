import {launch} from '../src/cinetic-adapter/native-launch.mjs';
try {
  await launch(process.argv.slice(2));
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
