import { spawn } from 'child_process';
import { createServer } from 'vite';

async function startDevServer() {
  console.log('Starting Vite dev server...');
  
  const server = await createServer({
    configFile: './vite.config.ts',
    mode: 'development'
  });
  
  await server.listen(5173);
  console.log('Vite dev server running on http://localhost:5173');
  
  return server;
}

function startElectron() {
  console.log('Starting Electron...');
  
  const electron = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
  });
  
  electron.on('close', (code) => {
    console.log(`Electron process exited with code ${code}`);
    process.exit(code);
  });
  
  return electron;
}

async function main() {
  try {
    const server = await startDevServer();
    
    // Wait a bit for the server to be ready
    setTimeout(() => {
      startElectron();
    }, 2000);
    
    // Handle process termination
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      server.close();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error starting development environment:', error);
    process.exit(1);
  }
}

main();
