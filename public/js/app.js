angular.module('tradeApp', ['ui.router', 'ngAnimate', 'toastr', 'ui.bootstrap'])
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
            coin_choice_interval: null,
            balance: null,
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
                $scope.loading = false;
            }, () => {
                $scope.loading = false;
            });
        };

        $scope.getTrades = function(){
            const page = $scope.currentPage;
            $http.get(`/api/trades?page=${page}`).then((response) => {
                if (response.data) {
                    const data = response.data;
                    $scope.totalTrades = data.total;
                    $scope.trades = data.data;
                }
            });
        };

        $scope.getServerData = function () {
            $http.get('/api/setup').then((config) => {
                if (config.data) {
                    $scope.setup = config.data;
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

        $scope.getServerData();
        $scope.getTrades();

        $interval(() => {
            $scope.getTrades();
        }, 1000 * 10);

    }]);