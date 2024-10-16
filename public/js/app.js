angular.module('tradeApp', ['ui.router', 'ngAnimate', 'toastr', 'ui.bootstrap', 'ui.select', 'ngSanitize'])
    .config(function ($urlRouterProvider, $stateProvider) {
        $stateProvider.state({
            name: 'login',
            url: '/login',
            templateUrl: 'pages/login.html',
            controller: 'LoginController'
        }).state({
            name: 'main',
            url: '/main',
            templateUrl: 'pages/main.html',
            controller: 'TradeController'
        });
        $urlRouterProvider.otherwise('login');
    })
    .controller('LoginController', ['$scope', '$state', '$http', '$filter', '$interval', 'toastr', function ($scope, $state, $http, $filter, $interval, toastr) {
        if (localStorage.getItem('auth-token')) {
            $state.go('main');
        }
        $scope.balance = null;
        $scope.loading = false;
        $scope.credentials = {
            username: '',
            password: ''
        };
        $scope.login = function () {
            $scope.loading = true;
            $http.post('/api/login', $scope.credentials).then(
                (resp) => {
                    $scope.loading = false;
                    $state.go('main');
                    localStorage.setItem('auth-token', resp.data.token);
                },
                (err) => {
                    $scope.loading = false;
                    toastr.error(err.data.message, 'Oops!');
                }
            );
        };
    }])
    .controller('TradeController', ['$scope', '$state', '$http', '$filter', '$interval', 'toastr', function ($scope, $state, $http, $filter, $interval, toastr) {

        if (!localStorage.getItem('auth-token')) {
            $state.go('login');
        }
        $scope.coins = [];
        $scope.timeFrames = [
            '1m',
            '3m',
            '5m',
            '15m',
            '30m',
            '1h',
            '2h',
            '4h',
            '6h',
            '8h',
            '12h',
            '1d',
            '3d',
            '1w',
            '1M'
        ];
        $scope.pairs = [
            'BTC',
            'BNB',
            'ETH',
            'USDT'
        ];
        $scope.loading = false;
        $scope.currentPage = 1;
        $scope.trades = [];
        $scope.totalTrades = 0;
        $scope.setup = {
            pair: null,
            simultaneous_trade: null,
            candle_interval: null,
            rsi_sensibility: null,
            max_amout_per_trade: null,
            coins: [],
            macd_fast_period: null,
            macd_slow_period: null,
            macd_signal_period: null,
            running: false,
            trading: false
        };

        $scope.pageChanged = function ($event) {
            $scope.getTrades();
        };

        $scope.updateConfig = function () {
            $scope.loading = true;
            $http.post('/api/setup', $scope.setup).then(() => {
                toastr.success('Configurações alteradas com sucesso.', 'Sucesso!');
                $scope.getTrades();
                $scope.loading = false;
            }, () => {
                $scope.loading = false;
            });
        };

        $scope.getTrades = function () {
            const page = $scope.currentPage;
            $http.get(`/api/trades?page=${page}`).then((response) => {
                if (response.data) {
                    const data = response.data;
                    $scope.totalTrades = data.total;
                    $scope.trades = data.data;
                    $scope.dailySuccessRate = Math.round(data.dailySuccessRate);
                    $scope.balance = data.balance ? parseFloat(data.balance.free) : 0;
                }
            }, (response) => {
                if (response.status == 401) {
                    localStorage.removeItem('auth-token');
                    $state.go('login');
                }
            });
        };

        $scope.getServerData = function () {
            $http.get('/api/setup').then((response) => {
                if (response.data) {
                    const data = response.data;
                    $scope.setup = data.setup || $scope.setup;
                    $scope.coins = data.coins || [];
                }
            }, (response) => {
                if (response.status == 401) {
                    localStorage.removeItem('auth-token');
                    $state.go('login');
                }
            });
        };

        $scope.logout = function () {
            $scope.loading = true;
            $http.get('/api/logout', $scope.credentials).then(
                (resp) => {
                    localStorage.removeItem('auth-token');
                    $state.go('login');
                },
                (err) => {
                    localStorage.removeItem('auth-token');
                    $state.go('login');
                }
            );
        };

        $scope.export = function(){
            window.open('/api/trades/export');
        };

        $scope.getServerData();
        $scope.getTrades();

        $interval(() => {
            $scope.getTrades();
        }, 1000 * 10);

    }]);