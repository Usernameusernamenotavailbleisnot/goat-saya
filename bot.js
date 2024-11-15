const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { DateTime } = require('luxon');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

class Goats {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9",
            "Content-Type": "application/json",
            "Origin": "https://dev.goatsbot.xyz",
            "Referer": "https://dev.goatsbot.xyz/",
            "Sec-Ch-Ua": '"Chromium";v="130", "Microsoft Edge";v="130", "Not?A_Brand";v="99", "Microsoft Edge WebView2";v="130"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0"
        };
        
        this.features = {
            watchAds: false,
            cinema: false,
            missions: false,
            checkin: false,
            slotMachine: false
        };
    }

    log(accountInfo, msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logMsg = `[${timestamp}] [${accountInfo}] - ${msg}`;
        
        switch(type) {
            case 'success':
                console.log(logMsg.green);
                break;
            case 'custom':
                console.log(logMsg.magenta);
                break;        
            case 'error':
                console.log(logMsg.red);
                break;
            case 'warning':
                console.log(logMsg.yellow);
                break;
            default:
                console.log(logMsg.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Waiting ${i} seconds to continue =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    async login(rawData, axiosInstance) {
        const url = "https://dev-api.goatsbot.xyz/auth/login";
        const userData = JSON.parse(decodeURIComponent(rawData.split('user=')[1].split('&')[0]));
        
        try {
            const response = await axiosInstance.post(url, {}, { 
                headers: {
                    ...this.headers,
                    'Rawdata': rawData
                }
            });

            if (response.status === 201) {
                const { age, balance } = response.data.user;
                const accessToken = response.data.tokens.access.token;
                return { 
                    success: true,
                    data: { age, balance, accessToken },
                    userData
                };
            } else {
                return { success: false, error: 'Login failed' };
            }
        } catch (error) {
            if (error.response?.status === 429) {
                return { success: false, error: 'Rate limited', rateLimited: true };
            }
            return { success: false, error: error.message };
        }
    }

    async watchAds(accessToken, axiosInstance, accountInfo) {
        const watchTime = Math.floor(Math.random() * (50 - 20 + 1)) + 20;
        
        try {
            this.log(accountInfo, `Starting to watch ads for ${watchTime} seconds...`, 'info');
            await this.countdown(watchTime);

            const response = await axiosInstance.post(
                'https://dev-api.goatsbot.xyz/missions/action/66db47e2ff88e4527783327e',
                {},
                {
                    headers: {
                        ...this.headers,
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            if (response.status === 201) {
                this.log(accountInfo, `Successfully claimed ads reward +200`, 'success');
                return true;
            }
        } catch (error) {
            if (error.response?.status === 429) {
                this.log(accountInfo, `Rate limited. Waiting 5 minutes...`, 'warning');
                await this.countdown(300);
            } else {
                this.log(accountInfo, `Watch ads error: ${error.message}`, 'error');
            }
        }
        return false;
    }

    async checkCinemaStatus(accessToken, axiosInstance) {
        try {
            const response = await axiosInstance.get('https://dev-api.goatsbot.xyz/goat-cinema', {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            return response.data.remainTime || 0;
        } catch (error) {
            return 0;
        }
    }

    async claimCinema(accessToken, axiosInstance, accountInfo) {
        try {
            const watchTime = Math.floor(Math.random() * (25 - 20 + 1)) + 20;
            this.log(accountInfo, `Watching cinema for ${watchTime} seconds...`, 'info');
            await this.countdown(watchTime);

            const response = await axiosInstance.post(
                'https://dev-api.goatsbot.xyz/goat-cinema/watch',
                {},
                {
                    headers: {
                        ...this.headers,
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            if (response.status === 201) {
                this.log(accountInfo, `Successfully claimed cinema reward`, 'success');
                return true;
            }
        } catch (error) {
            if (error.response?.status === 429) {
                this.log(accountInfo, `Rate limited. Waiting 5 minutes...`, 'warning');
                await this.countdown(300);
            } else {
                this.log(accountInfo, `Cinema claim error: ${error.message}`, 'error');
            }
        }
        return false;
    }

    async handleCinema(accessToken, axiosInstance, accountInfo) {
        const remainingCinema = await this.checkCinemaStatus(accessToken, axiosInstance);
        if (remainingCinema > 0) {
            this.log(accountInfo, `Found ${remainingCinema} cinema watch(es) available`, 'info');
            for (let i = 0; i < remainingCinema; i++) {
                await this.claimCinema(accessToken, axiosInstance, accountInfo);
                if (i < remainingCinema - 1) {
                    const delay = Math.floor(Math.random() * (5 - 3 + 1)) + 3;
                    await this.countdown(delay);
                }
            }
        } else {
            this.log(accountInfo, `No cinema watches available`, 'warning');
        }
    }

    async getMissions(accessToken, axiosInstance) {
        const url = "https://api-mission.goatsbot.xyz/missions/user";
        try {
            const response = await axiosInstance.get(url, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.status === 200) {
                const missions = {
                    special: [],
                    regular: []
                };
                
                Object.keys(response.data).forEach(category => {
                    response.data[category].forEach(mission => {
                        if (category === 'SPECIAL MISSION') {
                            missions.special.push(mission);
                        } 
                        else if (mission.status === false) {
                            missions.regular.push(mission);
                        }
                    });
                });
                return { success: true, missions };
            }
            return { success: false, error: 'Failed to get missions' };
        } catch (error) {
            if (error.response?.status === 429) {
                return { success: false, error: 'Rate limited', rateLimited: true };
            }
            return { success: false, error: error.message };
        }
    }

    async completeMission(mission, accessToken, axiosInstance) {
        if (mission.type === 'Special') {
            const now = DateTime.now().toUnixInteger();
            
            if (mission.next_time_execute && now < mission.next_time_execute) {
                const timeLeft = mission.next_time_execute - now;
                return { success: false, error: `Mission ${mission.name} is in cooldown: ${timeLeft} seconds` };
            }
        }

        const url = `https://dev-api.goatsbot.xyz/missions/action/${mission._id}`;
        try {
            const response = await axiosInstance.post(url, {}, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return { success: response.status === 201 };
        } catch (error) {
            if (error.response?.status === 429) {
                return { success: false, error: 'Rate limited', rateLimited: true };
            }
            return { success: false, error: error.message };
        }
    }

    async handleMissions(accessToken, axiosInstance, accountInfo) {
        const missionsResult = await this.getMissions(accessToken, axiosInstance);
        if (!missionsResult.success) {
            if (missionsResult.rateLimited) {
                this.log(accountInfo, `Rate limited. Waiting 5 minutes...`, 'warning');
                await this.countdown(300);
            } else {
                this.log(accountInfo, `Unable to get mission list: ${missionsResult.error}`, 'error');
            }
            return;
        }

        const { special, regular } = missionsResult.missions;

        for (const mission of special) {
            this.log(accountInfo, `Processing special mission: ${mission.name}`, 'info');
            const result = await this.completeMission(mission, accessToken, axiosInstance);
            
            if (result.success) {
                this.log(accountInfo, `Mission ${mission.name} completed successfully | Reward: ${mission.reward}`, 'success');
            } else {
                if (result.rateLimited) {
                    this.log(accountInfo, `Rate limited. Waiting 5 minutes...`, 'warning');
                    await this.countdown(300);
                } else {
                    this.log(accountInfo, `Mission ${mission.name} failed: ${result.error}`, 'error');
                }
            }
            await this.countdown(2);
        }

        for (const mission of regular) {
            const result = await this.completeMission(mission, accessToken, axiosInstance);
            if (result.success) {
                this.log(accountInfo, `Mission ${mission.name} completed successfully | Reward: ${mission.reward}`, 'success');
            } else {
                if (result.rateLimited) {
                    this.log(accountInfo, `Rate limited. Waiting 5 minutes...`, 'warning');
                    await this.countdown(300);
                } else {
                    this.log(accountInfo, `Mission ${mission.name} failed: ${result.error}`, 'error');
                }
            }
            await this.countdown(2);
        }
    }

    async getCheckinInfo(accessToken, axiosInstance) {
        const url = "https://api-checkin.goatsbot.xyz/checkin/user";
        try {
            const response = await axiosInstance.get(url, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            if (response.status === 200) {
                return { 
                    success: true, 
                    data: response.data 
                };
            }
            return { success: false, error: 'Failed to get check-in info' };
        } catch (error) {
            if (error.response?.status === 429) {
                return { success: false, error: 'Rate limited', rateLimited: true };
            }
            return { success: false, error: error.message };
        }
    }

    async performCheckin(checkinId, accessToken, axiosInstance) {
        const url = `https://api-checkin.goatsbot.xyz/checkin/action/${checkinId}`;
        try {
            const response = await axiosInstance.post(url, {}, {
                headers: {
                    ...this.headers,
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return { success: response.status === 201 };
        } catch (error) {
            if (error.response?.status === 429) {
                return { success: false, error: 'Rate limited', rateLimited: true };
            }
            return { success: false, error: error.message };
        }
    }

    async handleCheckin(accessToken, axiosInstance, accountInfo) {
        try {
            const checkinInfo = await this.getCheckinInfo(accessToken, axiosInstance);
            
            if (!checkinInfo.success) {
                if (checkinInfo.rateLimited) {
                    this.log(accountInfo, `Rate limited. Waiting 5 minutes...`, 'warning');
                    await this.countdown(300);
                } else {
                    this.log(accountInfo, `Unable to get checkin info: ${checkinInfo.error}`, 'error');
                }
                return;
            }

            const { result, lastCheckinTime } = checkinInfo.data;
            const currentTime = Date.now();
            const timeSinceLastCheckin = currentTime - lastCheckinTime;
            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (timeSinceLastCheckin < twentyFourHours) {
                this.log(accountInfo, `Not enough time passed since last checkin`, 'warning');
                return;
            }

            const nextCheckin = result.find(day => !day.status);
            if (!nextCheckin) {
                this.log(accountInfo, `All checkin days completed`, 'custom');
                return;
            }

            const checkinResult = await this.performCheckin(nextCheckin._id, accessToken, axiosInstance);
            if (checkinResult.success) {
                this.log(accountInfo, `Day ${nextCheckin.day} checkin successful | Reward: ${nextCheckin.reward}`, 'success');
            } else {
                if (checkinResult.rateLimited) {
                    this.log(accountInfo, `Rate limited. Waiting 5 minutes...`, 'warning');
                    await this.countdown(300);
                } else {
                    this.log(accountInfo, `Day ${nextCheckin.day} checkin failed: ${checkinResult.error}`, 'error');
                }
            }
        } catch (error) {
            this.log(accountInfo, `Checkin processing error: ${error.message}`, 'error');
        }
    }

    async spin(accessToken, axiosInstance, accountInfo) {
        try {
            const response = await axiosInstance.post(
                'https://api-slotmachine.goatsbot.xyz/slot-machine/spin',
                {},
                {
                    headers: {
                        ...this.headers,
                        'Authorization': `Bearer ${accessToken}`
                    }
                }
            );

            if (response.status === 201) {
                const result = response.data.result;
                this.log(accountInfo, `Spin Result: ${result.result} | Reward: ${result.reward} ${result.unit}`, 'success');
                return true;
            }
        } catch (error) {
            if (error.response?.status === 429) {
                this.log(accountInfo, `Rate limited. Waiting 5 minutes...`, 'warning');
                await this.countdown(300);
            } else {
                this.log(accountInfo, `Spin error: ${error.message}`, 'error');
            }
        }
        return false;
    }

    async handleSlotMachine(accessToken, axiosInstance, accountInfo) {
        const maxSpins = 5; // Adjust this number based on daily spin limit
        let successfulSpins = 0;

        for (let i = 0; i < maxSpins; i++) {
            const success = await this.spin(accessToken, axiosInstance, accountInfo);
            if (success) {
                successfulSpins++;
                await this.countdown(2); // Wait 2 seconds between spins
            } else {
                break;
            }
        }

        if (successfulSpins > 0) {
            this.log(accountInfo, `Completed ${successfulSpins} spins`, 'custom');
        }
    }

    async processAccount(accountData, accountIndex) {
        const userData = JSON.parse(decodeURIComponent(accountData.split('user=')[1].split('&')[0]));
        const firstName = userData.first_name;
        const accountInfo = `Account ${accountIndex + 1} | ${firstName}`;
        
        const axiosInstance = axios.create({ 
            headers: this.headers,
            timeout: 30000
        });

        const loginResult = await this.login(accountData, axiosInstance);
        
        if (loginResult.success) {
            const { age, balance, accessToken } = loginResult.data;
            
            this.log(accountInfo, `Login successful!`, 'success');
            this.log(accountInfo, `Age: ${age}`, 'custom');
            this.log(accountInfo, `Balance: ${balance}`, 'custom');

            if (this.features.checkin) {
                await this.handleCheckin(accessToken, axiosInstance, accountInfo);
                await this.countdown(3);
            }

            if (this.features.missions) {
                await this.handleMissions(accessToken, axiosInstance, accountInfo);
                await this.countdown(3);
            }

            if (this.features.cinema) {
                await this.handleCinema(accessToken, axiosInstance, accountInfo);
                await this.countdown(3);
            }

            if (this.features.watchAds) {
                await this.watchAds(accessToken, axiosInstance, accountInfo);
                await this.countdown(3);
            }

            if (this.features.slotMachine) {
                await this.handleSlotMachine(accessToken, axiosInstance, accountInfo);
            }
        } else {
            if (loginResult.rateLimited) {
                this.log(accountInfo, `Login rate limited. Waiting 5 minutes...`, 'warning');
                await this.countdown(300);
            } else {
                this.log(accountInfo, `Login failed: ${loginResult.error}`, 'error');
            }
        }
    }
}

if (isMainThread) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const askQuestion = (question) => new Promise((resolve) => rl.question(question, resolve));

    (async () => {
        console.log(colors.yellow('='.repeat(50)));
        console.log(colors.green('GOATS BOT - Enhanced Version'));
        console.log(colors.yellow('='.repeat(50)));

        const goats = new Goats();

        // Ask for features to enable
        goats.features.watchAds = (await askQuestion('Enable Auto Watch Ads? (y/n): ')).toLowerCase() === 'y';
        goats.features.cinema = (await askQuestion('Enable Auto Cinema? (y/n): ')).toLowerCase() === 'y';
        goats.features.missions = (await askQuestion('Enable Auto Missions? (y/n): ')).toLowerCase() === 'y';
        goats.features.checkin = (await askQuestion('Enable Auto Check-in? (y/n): ')).toLowerCase() === 'y';
        goats.features.slotMachine = (await askQuestion('Enable Auto Slot Machine? (y/n): ')).toLowerCase() === 'y';

        const threadCount = parseInt(await askQuestion('Enter number of threads: '));

        rl.close();

        if (isNaN(threadCount) || threadCount < 1) {
            console.log(colors.red('Invalid thread count. Using 1 thread.'));
            threadCount = 1;
        }

        console.log(colors.cyan(`Starting bot with ${threadCount} threads...`));
        
        const dataFile = path.join(__dirname, 'data.txt');
        let data;
        
        try {
            data = fs.readFileSync(dataFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);
        } catch (error) {
            console.log(colors.red('Error reading data.txt file:', error.message));
            process.exit(1);
        }

        console.log(colors.cyan(`Found ${data.length} accounts`));
        const accountsPerThread = Math.ceil(data.length / threadCount);

        const workers = [];

        for (let i = 0; i < threadCount; i++) {
            const start = i * accountsPerThread;
            const end = Math.min(start + accountsPerThread, data.length);
            const workerData = {
                accounts: data.slice(start, end),
                startIndex: start,
                threadId: i + 1,
                features: goats.features
            };

            const worker = new Worker(__filename, { workerData });
            workers.push(worker);

            worker.on('error', (error) => {
                console.error(colors.red(`Thread ${i + 1} error:`, error));
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    console.error(colors.red(`Thread ${i + 1} stopped with exit code ${code}`));
                }
            });

            worker.on('message', (message) => {
                if (message.type === 'log') {
                    console.log(message.data);
                }
            });

            console.log(colors.green(`Thread ${i + 1} started with ${workerData.accounts.length} accounts`));
        }

        process.on('SIGINT', () => {
            console.log(colors.yellow('\nGracefully shutting down...'));
            for (const worker of workers) {
                worker.terminate();
            }
            process.exit(0);
        });
    })();
} else {
    const goats = new Goats();
    const { accounts, startIndex, threadId, features } = workerData;
    goats.features = features;

    (async () => {
        console.log(colors.green(`Thread ${threadId} started processing`));
        
        while (true) {
            try {
                for (let i = 0; i < accounts.length; i++) {
                    await goats.processAccount(accounts[i], startIndex + i);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                parentPort.postMessage({
                    type: 'log',
                    data: colors.cyan(`Thread ${threadId} completed one cycle`)
                });
                
                await goats.countdown(43200); // 12 hours wait before next cycle
            } catch (error) {
                console.error(colors.red(`Thread ${threadId} Error in main loop:`, error));
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    })().catch(error => {
        console.error(colors.red(`Thread ${threadId} Fatal Error:`, error));
        process.exit(1);
    });
}
