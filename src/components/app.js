import { h, Component } from 'preact';
import { Router } from 'preact-router';

import Store, { Consumer, store } from '../store';
import Home from '../containers/home';
import LeaveMessage from '../containers/leaveamessage';
import Register from '../containers/register';
import CustomFields from '../lib/customFields';
import Triggers from '../lib/triggers';

export default class App extends Component {

	/** Gets fired when the route changes.
	 *	@param {Object} event		"change" event from [preact-router](http://git.io/preact-router)
	 *	@param {string} event.url	The newly routed URL
	 */
	handleRoute = (/* ...args*/) => {
		// this.currentUrl = args[0].url;
	};

	componentDidMount() {
		this.handleTriggers();
		CustomFields.init();
	}

	componentWillUnmount() {
		CustomFields.reset();
	}

	handleTriggers() {
		const { state } = store;
		const { config: { online, enabled } } = state;

		if (!(online && enabled)) {
			return Triggers.enabled = false;
		}

		Triggers.enabled = true;
		Triggers.init();
	}

	renderScreen({ user, config, messages, triggered }) {
		const { settings: { displayOfflineForm, registrationForm, nameFieldRegistrationForm, emailFieldRegistrationForm }, online } = config;

		if (!online) {
			if (displayOfflineForm) {
				return <LeaveMessage {...config} default path="/LeaveMessage" />;
			}
			return <LeaveMessage {...config} default path="/LeaveMessage" />;

		}

		const showRegistrationForm = registrationForm && (nameFieldRegistrationForm || emailFieldRegistrationForm);
		if ((user && user.token) || !showRegistrationForm || triggered) {
			return <Home {...config} messages={messages} default path="/home" />;
		}
		return <Register {...config} default path="/register" />;
	}
	render() {
		return (
			<Store>
				<div id="app">
					<Consumer>
						{(state) => (
							<Router onChange={this.handleRoute}>
								{this.renderScreen(state)}
							</Router>)}
					</Consumer>
				</div>
			</Store>
		);
	}
}
