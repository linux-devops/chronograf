import React, {PropTypes} from 'react'
import {Link} from 'react-router'
import {connect} from 'react-redux'
import _ from 'lodash'
import classnames from 'classnames';

import LayoutRenderer from 'shared/components/LayoutRenderer';
import DashboardHeader from 'src/dashboards/components/DashboardHeader';
import timeRanges from 'hson!../../shared/data/timeRanges.hson';
import {getMappings, getAppsForHosts, getMeasurementsForHost, getAllHosts} from 'src/hosts/apis';
import {fetchLayouts} from 'shared/apis';
import {presentationButtonDispatcher} from 'shared/dispatchers'

const {
  shape,
  string,
  bool,
  func,
} = PropTypes

export const HostPage = React.createClass({
  propTypes: {
    source: shape({
      links: shape({
        proxy: string.isRequired,
      }).isRequired,
      telegraf: string.isRequired,
      id: string.isRequired,
    }),
    params: shape({
      hostID: string.isRequired,
    }).isRequired,
    location: shape({
      query: shape({
        app: string,
      }),
    }),
    inPresentationMode: bool,
    handleClickPresentationButton: func,
  },

  getInitialState() {
    const fifteenMinutesIndex = 1;

    return {
      layouts: [],
      hosts: [],
      timeRange: timeRanges[fifteenMinutesIndex],
    };
  },

  async componentDidMount() {
    const {source, params, location} = this.props;

    // fetching layouts and mappings can be done at the same time
    const {data: {layouts}} = await fetchLayouts();
    const {data: {mappings}} = await getMappings();
    const hosts = await getAllHosts(source.links.proxy, source.telegraf);
    const newHosts = await getAppsForHosts(source.links.proxy, hosts, mappings, source.telegraf);
    const measurements = await getMeasurementsForHost(source, params.hostID);

    const host = newHosts[this.props.params.hostID];
    const focusedApp = location.query.app;

    const filteredLayouts = layouts.filter((layout) => {
      if (focusedApp) {
        return layout.app === focusedApp;
      }

      return host.apps && host.apps.includes(layout.app) && measurements.includes(layout.measurement);
    });

    // only display hosts in the list if they match the current app
    let filteredHosts = hosts;
    if (focusedApp) {
      filteredHosts = _.pickBy(hosts, (val, __, ___) => {
        return val.apps.includes(focusedApp);
      });
    }

    this.setState({layouts: filteredLayouts, hosts: filteredHosts}); // eslint-disable-line react/no-did-mount-set-state
  },

  handleChooseTimeRange({lower}) {
    const timeRange = timeRanges.find((range) => range.queryValue === lower);
    this.setState({timeRange});
  },

  renderLayouts(layouts) {
    const autoRefreshMs = 15000;
    const {timeRange} = this.state;
    const {source} = this.props;

    const autoflowLayouts = layouts.filter((layout) => !!layout.autoflow);

    const cellWidth = 6; // Changed by Colin
    const cellHeight = 4;
    const pageWidth = 12;

    let cellCount = 0;
    const autoflowCells = autoflowLayouts.reduce((allCells, layout) => {
      return allCells.concat(layout.cells.map((cell) => {
        const x = (cellCount * cellWidth % pageWidth);
        const y = Math.floor(cellCount * cellWidth / pageWidth) * cellHeight;
        cellCount += 1;
        return Object.assign(cell, {
          w: cellWidth,
          h: cellHeight,
          x,
          y,
        });
      }));
    }, []);

    const staticLayouts = layouts.filter((layout) => !layout.autoflow);
    staticLayouts.unshift({cells: autoflowCells});

    let translateY = 0;
    const layoutCells = staticLayouts.reduce((allCells, layout) => {
      let maxY = 0;
      layout.cells.forEach((cell) => {
        cell.y += translateY;
        if (cell.y > translateY) {
          maxY = cell.y;
        }
        cell.queries.forEach((q) => {
          q.text = q.query;
          q.database = source.telegraf;
        });
      });
      translateY = maxY;

      return allCells.concat(layout.cells);
    }, []);

    return (
      <LayoutRenderer
        timeRange={timeRange}
        cells={layoutCells}
        autoRefreshMs={autoRefreshMs}
        source={source.links.proxy}
        host={this.props.params.hostID}
      />
    );
  },

  render() {
    const {params: {hostID}, location: {query: {app}}, source: {id}, inPresentationMode, handleClickPresentationButton} = this.props
    const {layouts, timeRange, hosts} = this.state
    const appParam = app ? `?app=${app}` : ''

    return (
      <div className="page">
        <DashboardHeader
          buttonText={hostID}
          timeRange={timeRange}
          isHidden={inPresentationMode}
          handleChooseTimeRange={this.handleChooseTimeRange}
          handleClickPresentationButton={handleClickPresentationButton}
        >
          {Object.keys(hosts).map((host, i) => {
            return (
              <li key={i}>
                <Link to={`/sources/${id}/hosts/${host + appParam}`} className="role-option">
                  {host}
                </Link>
              </li>
            );
          })}
        </DashboardHeader>
        <div className={classnames({
          'page-contents': true,
          'presentation-mode': inPresentationMode,
        })}>
          <div className="container-fluid full-width dashboard">
            { (layouts.length > 0) ? this.renderLayouts(layouts) : '' }
          </div>
        </div>
      </div>
    );
  },
});

const mapStateToProps = (state) => ({
  inPresentationMode: state.appUI.presentationMode,
})

const mapDispatchToProps = (dispatch) => ({
  handleClickPresentationButton: presentationButtonDispatcher(dispatch),
})

export default connect(mapStateToProps, mapDispatchToProps)(HostPage)
