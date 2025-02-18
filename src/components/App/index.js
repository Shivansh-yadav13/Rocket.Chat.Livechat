import { h, Component } from 'preact';
import { Router, route } from 'preact-router';
import queryString from 'query-string';

import history from '../../history';
import I18n from '../../i18n';
import Connection from '../../lib/connection';
import CustomFields from '../../lib/customFields';
import Hooks from '../../lib/hooks';
import { setWidgetLanguage } from '../../lib/locale';
import { parentCall } from '../../lib/parentCall';
import Triggers from '../../lib/triggers';
import userPresence from '../../lib/userPresence';
import Chat from '../../routes/Chat';
import ChatFinished from '../../routes/ChatFinished';
import GDPRAgreement from '../../routes/GDPRAgreement';
import LeaveMessage from '../../routes/LeaveMessage';
import Register from '../../routes/Register';
import SwitchDepartment from '../../routes/SwitchDepartment';
import TriggerMessage from '../../routes/TriggerMessage';
import { Provider as StoreProvider, Consumer as StoreConsumer, store } from '../../store';
import { visibility, isActiveSession, setInitCookies } from '../helpers';

function isRTL(s) {
	const rtlChars = '\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC';
	const rtlDirCheck = new RegExp(`^[^${ rtlChars }]*?[${ rtlChars }]`);

	return rtlDirCheck.test(s);
}

export class App extends Component {
	state = {
		initialized: false,
		poppedOut: false,
	}

	handleRoute = async () => {
		setTimeout(() => {
			const {
				config: {
					settings: {
						registrationForm,
						nameFieldRegistrationForm,
						emailFieldRegistrationForm,
						forceAcceptDataProcessingConsent: gdprRequired,
					},
					online,
					departments = [],
				},
				gdpr: {
					accepted: gdprAccepted,
				},
				triggered,
				user,
			} = this.props;

			setInitCookies();

			if (gdprRequired && !gdprAccepted) {
				return route('/gdpr');
			}

			if (!online) {
				parentCall('callback', 'no-agent-online');
				return route('/leave-message');
			}

			const showDepartment = departments.filter((dept) => dept.showOnRegistration).length > 0;

			const showRegistrationForm = (
				registrationForm
					&& (nameFieldRegistrationForm || emailFieldRegistrationForm || showDepartment)
			)
				&& !triggered
				&& !(user && user.token);
			if (showRegistrationForm) {
				return route('/register');
			}
		}, 100);
	}

	handleTriggers() {
		const { config: { online, enabled } } = this.props;

		Triggers.enabled = online && enabled;

		if (online && enabled) {
			Triggers.init();
		}
	}

	handleEnableNotifications = () => {
		const { dispatch, sound = {} } = this.props;
		dispatch({ sound: { ...sound, enabled: true } });
	}

	handleDisableNotifications = () => {
		const { dispatch, sound = {} } = this.props;
		dispatch({ sound: { ...sound, enabled: false } });
	}

	handleMinimize = () => {
		parentCall('minimizeWindow');
		const { dispatch } = this.props;
		dispatch({ minimized: true });
	}

	handleRestore = () => {
		parentCall('restoreWindow');
		const { dispatch, undocked } = this.props;
		const dispatchRestore = () => dispatch({ minimized: false, undocked: false });
		const dispatchEvent = () => {
			dispatchRestore();
			store.off('storageSynced', dispatchEvent);
		};
		if (undocked) {
			store.on('storageSynced', dispatchEvent);
		} else {
			dispatchRestore();
		}
	}

	handleOpenWindow = () => {
		parentCall('openPopout');
		const { dispatch } = this.props;
		dispatch({ undocked: true, minimized: false });
	}

	handleDismissAlert = (id) => {
		const { dispatch, alerts = [] } = this.props;
		dispatch({ alerts: alerts.filter((alert) => alert.id !== id) });
	}

	handleVisibilityChange = async () => {
		const { dispatch } = this.props;
		await dispatch({ visible: !visibility.hidden });
	}

	handleLanguageChange = () => {
		this.forceUpdate();
	}

	dismissNotification = () => !isActiveSession();

	initWidget() {
		setWidgetLanguage();
		const { minimized, iframe: { visible }, dispatch } = this.props;
		parentCall(minimized ? 'minimizeWindow' : 'restoreWindow');
		parentCall(visible ? 'showWidget' : 'hideWidget');

		visibility.addListener(this.handleVisibilityChange);
		this.handleVisibilityChange();
		window.addEventListener('beforeunload', () => {
			visibility.removeListener(this.handleVisibilityChange);
			dispatch({ minimized: true, undocked: false });
		});

		I18n.on('change', this.handleLanguageChange);
	}

	checkPoppedOutWindow() {
		// Checking if the window is poppedOut and setting parent minimized if yes for the restore purpose
		const { dispatch } = this.props;
		const poppedOut = queryString.parse(window.location.search).mode === 'popout';
		this.setState({ poppedOut });
		if (poppedOut) {
			dispatch({ minimized: false });
		}
	}

	async initialize() {
		// TODO: split these behaviors into composable components
		await Connection.init();
		this.handleTriggers();
		CustomFields.init();
		Hooks.init();
		userPresence.init();
		this.initWidget();
		this.checkPoppedOutWindow();

		this.setState({ initialized: true });
		parentCall('ready');
	}

	async finalize() {
		CustomFields.reset();
		userPresence.reset();
		visibility.removeListener(this.handleVisibilityChange);
		I18n.off('change', this.handleLanguageChange);
	}

	componentDidMount() {
		this.initialize();
	}

	componentWillUnmount() {
		this.finalize();
	}

	componentDidUpdate() {
		document.dir = isRTL(I18n.t('Yes')) ? 'rtl' : 'ltr';
	}

	render = ({
		sound,
		undocked,
		minimized,
		expanded,
		alerts,
		modal,
		config,
	}, { initialized, poppedOut }) => {
		if (!initialized) {
			return null;
		}
		if (!config.enabled) {
			return null;
		}
		const screenProps = {
			notificationsEnabled: sound && sound.enabled,
			minimized: !poppedOut && (minimized || undocked),
			expanded: !minimized && expanded,
			windowed: !minimized && poppedOut,
			sound,
			alerts,
			modal,
			onEnableNotifications: this.handleEnableNotifications,
			onDisableNotifications: this.handleDisableNotifications,
			onMinimize: this.handleMinimize,
			onRestore: this.handleRestore,
			onOpenWindow: this.handleOpenWindow,
			onDismissAlert: this.handleDismissAlert,
			dismissNotification: this.dismissNotification,
		};

		return (
			<Router history={history} onChange={this.handleRoute}>
				<Chat default path='/' {...screenProps} />
				<ChatFinished path='/chat-finished' {...screenProps} />
				<GDPRAgreement path='/gdpr' {...screenProps} />
				<LeaveMessage path='/leave-message' {...screenProps} />
				<Register path='/register' {...screenProps} />
				<SwitchDepartment path='/switch-department' {...screenProps} />
				<TriggerMessage path='/trigger-messages' {...screenProps} />
			</Router>
		);
	}
}

const AppConnector = () => (
	<div id='app'>
		<StoreProvider>
			<StoreConsumer>
				{({
					config,
					user,
					triggered,
					gdpr,
					sound,
					undocked,
					minimized = true,
					expanded = false,
					alerts,
					modal,
					dispatch,
					iframe,
				}) => (
					<App
						config={config}
						gdpr={gdpr}
						triggered={triggered}
						user={user}
						sound={sound}
						undocked={undocked}
						minimized={minimized}
						expanded={expanded}
						alerts={alerts}
						modal={modal}
						dispatch={dispatch}
						iframe={iframe}
					/>
				)}
			</StoreConsumer>
		</StoreProvider>
	</div>
);

export default AppConnector;
