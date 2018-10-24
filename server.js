const express = require('express');
const mysql = require('mysql');
var bodyParser 			= 	require('body-parser');
var expressValidator = require('express-validator');

var app = express();



app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine','ejs');
// app.use(expressValidator());

app.use(expressValidator({
  errorFormatter: function(param, msg, value) {
      var namespace = param.split('.')
      , root    = namespace.shift()
      , formParam = root;

    while(namespace.length) {
      formParam += '[' + namespace.shift() + ']';
    }
    return {
      param : formParam,
      msg   : msg,
      value : value
    };
  }
}));


//authenticate packages
var session = require('express-session');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var MySQLStore = require('express-mysql-session')(session);
var bcrypt = require('bcryptjs');
const saltRounds = 10;



app.use(bodyParser.json());
app.use('/js',express.static(__dirname + '/node_modules/bootstrap/dist/js'));
app.use('/js',express.static(__dirname + '/node_modules/tether/dist/js'));
app.use('/js',express.static(__dirname + '/node_modules/jquery/dist'));
app.use('/',express.static(__dirname + '/node_modules/moment'));
app.use('/js',express.static(__dirname + '/scripts/js'));
app.use('/css',express.static(__dirname + '/node_modules/bootstrap/dist/css'));
app.use('/css',express.static(__dirname + '/styles/css'));

app.use(require('connect-flash')());
app.use(function (req, res, next) {
  res.locals.messages = require('express-messages')(req, res);
  next();
});


var options = {
  host    : 'localhost',
  user    : 'root',
  password: '',
  database: 'shopdatabase'
};

var sessionStore = new MySQLStore(options);

app.use(session({
  secret :'secret',
  store: sessionStore,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next){
  res.locals.isAuthenticated = req.isAuthenticated();
  next();
});


//database connection
const db = mysql.createConnection({
  host    : 'localhost',
  user    : 'root',
  password: '',
  database: 'shopdatabase'
});

//check connection
db.connect((err)=>{
  if(err){
    throw err;
  }
  console.log('Mysql Connected..');
});




// Local Strategy login
passport.use(new LocalStrategy(function(email, password, done) {

    // Match Username
    let sql = 'SELECT * FROM employee_details WHERE e_email = ?';
    db.query(sql, [email], function(err, rows) {
      if (err)
        return done(err);
      if (!rows.length) {
        return done(null, false, {message: 'Wrong user'});
      }
      else{
        const hash = rows[0].e_password.toString();
        //  Match Password
        bcrypt.compare(password, hash , function(err, isMatch) {
          if(err)
            return done(err);
          if(isMatch){
              return done(null, rows[0].e_id);
          }
          else {
            return done(null, false, {message: 'Wrong pass'});
          }
        });
      }
    });
  }));


  passport.serializeUser(function(e_id, done) {
    done(null, e_id);
    //yfuyfjh
  });
  
  passport.deserializeUser(function(e_id, done) {
      done(null, e_id);
      //ghgh
  });
  
app.get('/',(req, res)=>{
  res.render('pages/index');
});

app.get('/register',(req, res)=>{
  let sql = 'SELECT * FROM users';
  let query = db.query(sql,(err, users)=>{
    if(err) throw err;
    res.render('pages/register',{
    pageTitle: 'Register',
    errors:'' ,
    users: users
    })
  })
});

app.get('/profile', authenticationMiddleware() ,(req, res)=>{
  res.render('pages/profile');
});

app.post('/register',(req, res)=>{

  //validation
req.checkBody('email', 'Email field cannot be empty.').notEmpty();
req.checkBody('email', 'The email you entered is invalid, please try again.').isEmail();
req.checkBody('password', 'Password must be between 8-100 characters long.').len(8, 100);
req.checkBody('password2', 'Password must be between 8-100 characters long.').len(8, 100);
req.checkBody('password2', 'Passwords do not match, please try again.').equals(req.body.password);

const errors = req.validationErrors();

if(errors){
  let sql = 'SELECT * FROM users';
  let query = db.query(sql,(err, users)=>{
    if(err) throw err;
    res.render('pages/register',{
    pageTitle: 'Register',
    errors:errors ,
    users: users
    })
  });

}else{

  bcrypt.hash(req.body.password, saltRounds, function(err, hash){
    let inserted_datas = {
      e_name:req.body.name,
      e_email:req.body.email,
      e_password:hash,
      e_type:req.body.usertype,
      e_education:req.body.education,
      e_aadhar_no: req.body.aadhar
    };
    let sql = 'INSERT INTO employee_details SET ?';
    let query = db.query(sql, inserted_datas, (err, results, fields)=>{
      if(err) throw err;
      db.query('SELECT LAST_INSERT_ID() as e_id', function(error, results, fields){
        if(error) throw error;
        const e_id = results[0];
        console.log(results[0]);
        req.login(e_id, function(err){
          req.flash('success', 'Registration SuccessFull!!');
          res.redirect('/profile');
        });
      });
    });
  });
}//else
});


app.get('/login',(req, res)=>{
       res.render('pages/login',{
        pageTitle: "Login"
  });
});

app.get('/logout', (req, res)=>{
  req.logout();
  req.session.destroy(() => {
       res.clearCookie('connect.sid')
       res.redirect('/')
   });
});


//login using passport
/*
app.post('/login', passport.authenticate(
  'local',{
    successRedirect: '/profile',
    failureRedirect: '/login'
  }));
*/
app.post('/login',  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/profile');
  });

app.get('/payment_details', (req, res)=>{
  let sql_payment = 'SELECT * FROM payment_details';
  let query_payment = db.query(sql_payment, (err, payments)=>{


  let sql = 'SELECT product_title FROM products_details';
  let query = db.query(sql, (err, products)=>{


  let sql1 = 'SELECT stokist_title, stokist_location FROM stokist_details';
  let query1 = db.query(sql1, (err, results)=>{
    if(err) throw err;
    res.render('pages/payment_details',{
      pageTitle:"Payment Details",
      stores: results,
      products: products,
      payments: payments
    });
  });
});
});
});


app.post('/payment_details', (req, res)=>{
  let inserted_datas = {
    payment_recieved_amount: req.body.recieved_amount,
    payment_recieved_on: req.body.recieved_on,
    payment_recieved_from: req.body.reciever,
    payment_recieved_for: req.body.recieved_for
  };

  let sql = 'INSERT INTO payment_details SET ?';
  let query = db.query(sql,inserted_datas, (err, results)=>{
    if(err) throw err;
    else {
      res.redirect('/payment_details');
      console.log("payment saved");
    }
  });
});


function authenticationMiddleware() {
  return (req, res, next) => {
    console.log(`req.session.passport.user: ${JSON.stringify(req.session.passport)}`);

      if (req.isAuthenticated()) return next();
      res.redirect('/login')
  }
}

app.listen(3000, ()=>{
  console.log("Express server is running on port 3000");
});
