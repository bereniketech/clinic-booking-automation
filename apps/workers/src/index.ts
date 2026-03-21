async function startWorkers(): Promise<void> {
  // Worker runtime scaffold; queue processors are added in follow-up tasks.
  // eslint-disable-next-line no-console
  console.log('Workers process started');
}

void startWorkers();