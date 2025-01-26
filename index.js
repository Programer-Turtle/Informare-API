// Import Express
const express = require('express');
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const bcrypt = require("bcrypt");
const fs = require('fs');
const app = express();
app.use(express.json());
app.use(cors());

// Define a port
const PORT = 3000;

Data = {
}

async function CheckIfExpired(dateString) {
    // Convert the input date string to a Date object
    const dateComponents = dateString.split("-");
    const month = parseInt(dateComponents[1], 10);
    const day = parseInt(dateComponents[2], 10);
    const year = parseInt(dateComponents[0], 10);
  
    const inputDate = new Date(year, month - 1, day); // Note: Month is zero-based
    inputDate.setHours(0, 0, 0, 0); // Set time to midnight
  
    // Get the current date
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Set time to midnight
  
    // Check if the input date is in the past (expired)
    if (currentDate >= inputDate) {
      return true;
    } else {
      return false;
    }
  }
  
  async function CheckIfDatePassed(dateString) {
    // Convert the input date string to a Date object
    const dateComponents = dateString.split("-");
    const year = parseInt(dateComponents[0], 10);
    const month = parseInt(dateComponents[1], 10);
    const day = parseInt(dateComponents[2], 10);
  
    const inputDate = new Date(year, month - 1, day, 0, 0, 0, 0); // Set time to midnight
  
    // Get the current date in the user's local time
    const currentDate = new Date();
  
    // Get the date one day before today in the user's local time
    const yesterday = new Date(currentDate);
    yesterday.setDate(currentDate.getDate() - 3);
    yesterday.setHours(0, 0, 0, 0); // Set time to midnight
  
    // Check if the input date is yesterday or before
    if (inputDate <= yesterday) {
      return true;
    } else {
      return false;
    }
  }
  
  //BanHandler
  async function LocalCheckBanStatus(Username) {
    try {
      let user = Data[Username];
      await CheckifUserBanExpired(Username);
      const BanData = user.Banned;
      if (BanData.Status != "Unban") {
        return BanData;
      } else {
        return false;
      }
    } catch (error) {
      return {
        error: "Error occurred when checking if account was banned",
        statusCode: 500,
      };
    }
  }
  
  async function BanUser(Username, Status, Expire_Date, Reason, banBy) {
    try {
      let user = Data[Username];
      if (!user) {
        return { error: "User not found", statusCode: 404 };
      }
      let BanData = user.Banned;
      BanData.Status = Status;
      BanData.Expire_Date = Expire_Date;
      BanData.Reason = Reason;
      BanData.Banned_By = banBy;
      Data[Username]= user;
      //Adds to banned users
      let BannedUsers = Data["BanUsers"];
      if (!BannedUsers.includes(Username)) {
        BannedUsers.push(Username);
  
        Data["BanUsers"] = BannedUsers;
      }
    } catch (error) {
      console.log("Error occurred when banning User: " + error);
      return { error: "Error While Banning User", statusCode: 500 };
    }
  }
  
  async function UnbanUser(Username) {
    console.log("Unbanning User: " + Username);
    try {
      let user = Data[Username];
      if (!user) {
        return { error: "User not found", statusCode: 404 };
      }
      const BanData = user.Banned;
      BanData.Status = "Unban";
      BanData.Expire_Date = "None";
      BanData.Reason = "None";
      Data[Username] = user;
      //Removes from banned users
      let BannedUsers = Data["BanUsers"];
      if (BannedUsers.includes(Username)) {
        for (let i = 0; i < BannedUsers.length; i++) {
          if (BannedUsers[i] === Username) {
            BannedUsers.splice(i, 1);
          }
        }
        Data["BanUsers"] = BannedUsers;
      }
      //Returns true
      return true;
    } catch (error) {
      console.log("Error occurred when unbanning User: " + error);
      return { error: "Error While Unbanning User", statusCode: 500 };
    }
  }
  
  async function CheckifUserBanExpired(username) {
    try {
      let user = Data[username];
      if (!user) {
        return { error: "User Doesn't Exist", statusCode: 500 };
      }
      if (await CheckIfExpired(user.Banned.Expire_Date)) {
        console.log("User Ban Expired");
        if (await UnbanUser(username)) {
          return true;
        }
      }
    } catch (error) {
      return { error, statusCode: 500 };
    }
  }
  
  //Account Login Handler
  async function LocalCheckToken(Username, Token) {
    try {
      let user = Data[Username];
      if (user.tokens && user.tokens.includes(Token)) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }
  
  async function LocalCheckPassword(Username, Password) {
    try {
      let user = Data[Username];
      const isMatch = await bcrypt.compare(Password, user.password);
      if (isMatch) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }
  
  //Persmission Handler
  async function SetPresmission(Username, Permission, Expire_Date) {
    let user = Data[Username];
    let Users_permissions = user.PremissionLevel;
    Users_permissions.Level = Permission;
    Users_permissions.Expire_date = Expire_Date;
    user.PremissionLevel = Users_permissions
    Data[Username] = user;
  }
  
  async function LocalCheckIfPermission(Username, Permission) {
    try {
      let user = Data[Username];
      let Users_permissions = user.PremissionLevel;
  
      //Check if permission is expired
      if (await CheckIfExpired(Users_permissions.Expire_date)) {
        await SetPresmission(Username, "Free", "None");
        return false;
      }
  
      //Check if user has premission
      if (Users_permissions.Level == Permission) {
        return true;
      } else if (Users_permissions.Level == "Admin") {
        return true;
      } else if (
        Permission == "Pro" &&
        ["Daily_Messenger", "Moderator"].includes(Users_permissions.Level)
      ) {
        return true;
      } else if (
        Permission == "Moderator" &&
        ["Daily_Messenger", "Head_Judge", "Head_Moderator", "Designer"].includes(
          Users_permissions.Level,
        )
      ) {
        return true;
      } else if (
        Permission == "News-Writer" &&
        ["Daily_Messenger"].includes(Users_permissions.Level)
      ) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      return false;
    }
  }
  
  async function LocalCheckIfPermissionWithoutHierarchy(Username, Permission) {
    try {
      let user = Data[Username];
      const Users_permissions = user.PremissionLevel;
  
      //Check if permission is expired
      if (await CheckIfExpired(Users_permissions.Expire_date)) {
        await SetPresmission(Username, "Free", "None");
        return false;
      }
  
      //Check if user has premission
      if (Users_permissions.Level == Permission) {
        return true;
      }
    } catch (error) {
      return false;
    }
  }

app.post("/createAccount", async (req, res) => {
    const { username, password } = req.body;
    try {
      console.log("Test")
      let hashedPassword = await bcrypt.hash(password, 10); // Hashing the password
      let existingUser = Data["username"]
  
      if (existingUser) {
        return res.status(500).json({ error: "Account Already Exists" });
      }
  
      if (password.length > 20 || username.length > 50) {
        return res.status(500).json({
          error: "You have exceeded the password limit. This is against policy.",
        });
      }
  
        Data[username] = {
            password: hashedPassword,
            Banned: { Status: "Unban", Expire_Date: "None", Reason: "None" },
            PremissionLevel: { Level: "Free", Expire_date: "None" },
            Theme: { Type: "Light", Rgb: "rgb(0, 255, 255)" },
            Homework: [],
            Verified: false,
            Alerts: {
                welcome: {
                    Subject: "Welcome to Alerts!",
                    Body: "Welcome to Alerts! This service allows you to get messages in regards to support, feedback, and more.",
                    Sender: "System",
                    Read: false,
                }
            }
      };
      let AllAccounts = Data["AllUsers"];
      AllAccounts.push(username);
      Data["AllUsers"] = AllAccounts;
      res.status(200).json({ message: "Account created successfully." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error occurred during account creation" });
    }
  });

  app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const userData = Data[username];
      if (!userData) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
  
      const isMatch = await bcrypt.compare(password, userData.password);
      if (isMatch) {
        //check if ban
  
        //Login and create keys
        const token = uuidv4(); // Generate a unique session token
        var CheckBan = await CheckifUserBanExpired(username);
        let BanStatus = await LocalCheckBanStatus(username);
        if (BanStatus != false) {
          BanStatus.token = token;
          return res.send(BanStatus);
        }
  
        // Initialize the tokens array if it doesn't exist
        if (!userData.tokens) {
          userData.tokens = [];
        }
        userData.tokens.push(token);
  
        Data[username] = userData; // Update the user data with the new token
        res.send({
          username: username,
          token: token,
          theme: userData.Theme.Type,
          Rgb: userData.Theme.Rgb,
        });
      } else {
        res.status(401).json({ error: "Invalid email or password" });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Error Occured" });
    }
  });

app.post("/checkifloggedin", async (req, res) => {
    const { username, token } = req.body;
    try {
      const ip = req.headers["x-forwarded-for"]
        ? req.headers["x-forwarded-for"].split(",")[0]
        : req.connection.remoteAddress;
      await CheckifUserBanExpired(username);
      let Banstatus = await LocalCheckBanStatus(username);
      if (Banstatus != false) {
        return res.send(Banstatus);
      }
      if (await LocalCheckToken(username, token)) {
        const user = Data[username];
        user.IP = ip;
        Data[username] = user;
        return res.send(true);
      } else {
        return res.send(false);
      }
    } catch (error) {
      res.status(500).json({ error: error });
    }
  });

app.post("/VerifyUsers", async (req, res) => {
    const { username, token, UserList, value} = req.body;
    try {
      let userData = Data[username];
      if (!userData) {
        return res.status(401).json({ error: "Not a User" });
      }
      if (!(await LocalCheckIfPermission(username, "Admin"))) {
        res.status(401).json({ error: "Not Admin" });
      }
      if (await LocalCheckToken(username, token)) {
        for (let i = 0; i<UserList.length; i++){
          let userTarget = Data[UserList[i]];
          userTarget.Verified = value;
          Data[UserList[i]] = userTarget;
        }
        res.status(200).json({message: "Verified Users"})
      } else {
        res.status(401).json({ error: "error" });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Error Occured" });
    }
  });

//Set Theme
app.post("/SetTheme", async (req, res) => {
    const { username, token, theme, Rbg } = req.body;
    if (!(await LocalCheckToken(username, token))) {
      return res.status(401).send("Incorrect Password");
    }
  
    try {
      let userData = Data[username];
      userData.Theme.Type = theme;
      userData.Theme.Rgb = Rbg;
      Data[username] = userData;
      console.log(
        "User : " + username + "\nchanged theme: " + theme + "\nRgb: " + Rbg,
      );
      res.send("Theme Set");
    } catch (e) {
      return res.status(500).send("Error Occured");
    }
  });
  
  app.post("/GetThemeData", async (req, res) => {
    const { username, token } = req.body;
    try {
      const userData = Data[username];
      if (!userData) {
        return res.status(401).json({ error: "Not a user" });
      }
      if (await LocalCheckToken(username, token)) {
        res.send({
          theme: userData.Theme.Type,
          Rgb: userData.Theme.Rgb,
        });
      } else {
        res.status(401).json({ error: "error" });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Error Occured" });
    }
  });

//Boring Backend Stuff
function saveDataToFile() {
    fs.writeFile('data.json', JSON.stringify(Data, null, 2), (err) => {
        if (err) {
            console.error('Error saving data:', err);
        } else {
            console.log('Data saved to data.json');
        }
    });
}

function loadDataFromFile() {
    try {
        if (fs.existsSync('data.json')) { // Check if the file exists
            const fileContent = fs.readFileSync('data.json', 'utf8'); // Read file synchronously
            Data = JSON.parse(fileContent); // Parse JSON and set to Data
            console.log('Data loaded from data.json:', Data);
        } else {
            console.log('data.json does not exist. Using default Data.');
        }
    } catch (error) {
        console.error('Error reading data.json:', error);
    }
}

setInterval(saveDataToFile, 60000); // 5 minutes

loadDataFromFile();
// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
