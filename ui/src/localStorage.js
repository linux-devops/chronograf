export const loadLocalStorage = () => {
  try {
    const serializedState = localStorage.getItem('state');

    return JSON.parse(serializedState) || {};
  } catch (err) {
    console.error(`Loading persisted state failed: ${err}`); // eslint-disable-line no-console
    return {};
  }
};

export const saveToLocalStorage = ({queryConfigs, timeRange, dataExplorer}) => {
  try {
    window.localStorage.setItem('state', JSON.stringify({
      queryConfigs,
      timeRange,
      dataExplorer,
    }));
  } catch (err) {
    console.error('Unable to save data explorer: ', JSON.parse(err)); // eslint-disable-line no-console
  }
};
