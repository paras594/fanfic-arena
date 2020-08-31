const fs = require("fs");
const User = require("../User/user.schema.js");
const Fiction = require("./fiction.schema.js");
const validate = require("./validators.js");
const sanitize = require("./sanitizers.js");

function createFiction(req, res) {
	// req.body { title, description, category, body }
	// req.file { path, destination, fieldname, mimetype...}
	// req.user
	const sanitizedData = sanitize.fictionInput(req.body);
	const { errors, isValid } = validate.fictionInput(sanitizedData);

	if (!isValid) {
		// delete file if input is invalid
		if (req.file) {
			fs.unlinkSync(req.file.path);
		}

		return res.status(400).json({
			message: "Validation errors",
			inputs: sanitizedData,
			errors
		});
	}

	let fictionImage;

	if (req.file) {
		fictionImage = "/uploads/" + req.file.filename;
	} else {
		fictionImage = "/images/default-fiction-image.svg";
	}

	// create fiction and save it
	const newFiction = new Fiction({
		userId: req.user._id,
		title: sanitizedData.title,
		description: sanitizedData.description,
		image: fictionImage,
		category: sanitizedData.category,
		body: sanitizedData.body
	});

	newFiction
		.save()
		.then(() => {
			let userFictions = req.user.fictions;
			userFictions.push(newFiction._id);

			User.findOneAndUpdate({ _id: req.user._id }, { fictions: userFictions }, { new: true })
				.then((user) => {
					res.status(201).json({
						message: "Fiction Created"
					});
				})
				.catch((err) => {
					console.log(err);
					res.status(500).json({
						message: "Server Error",
						errors: {
							error: "Failed to add fiction in user"
						}
					});
				});
		})
		.catch((err) => {
			console.log(err);
			return res.status(500).json({
				message: "Server error",
				errors: {
					error: "Failed to create fiction"
				}
			});
		});
}

function getFictions(req, res) {
	console.log(req.query);
	let sortQuery = req.query.sort ? req.query.sort : {};
	let limitQuery = req.query.limit ? parseInt(req.query.limit) : 0;

	Fiction.find({})
		.sort(sortQuery)
		.limit(limitQuery)
		.populate("userId", { _id: 1, username: 1, fullname: 1, email: 1, userImage: 1 })
		.then((fictions) => {
			return res.status(200).json({
				message: "Fictions data",
				fictions
			});
		})
		.catch((err) => {
			return res.status(400).json({
				message: "Request failed",
				errors: {
					error: err
				}
			});
		});
}

function getOneFiction(req, res) {
	const { fictionId } = req.params;
	const userFields = {
		_id: 1,
		username: 1,
		fullname: 1,
		email: 1,
		userImage: 1
	};

	Fiction.findOne({ _id: fictionId })
		.populate("userId", userFields)
		.populate("comments")
		.then((fiction) => {
			res.status(200).json({
				message: "Fiction data",
				fiction
			});
		})
		.catch((err) => {
			res.status(400).json({
				message: "Request failed.",
				errors: {
					error: err
				}
			});
		});
}

function getFictionByCategory(req, res) {
	const { category } = req.params;

	Fiction.find({ category })
		.then((fictions) => {
			res.status(200).json({
				message: `${category} related fictions`,
				fictions
			});
		})
		.catch((err) => {
			console.log(err);
			res.status(400).json({
				message: "Request failed",
				errors: {
					error: err
				}
			});
		});
}

async function getSearchResults(req, res) {
	const { q } = req.query;

	if (!q) {
		return res.status(400).json({
			message: "No query",
			errors: {
				error: "Pass search query with request"
			}
		});
	}

	const sanitizedQuery = sanitize.searchQuery(q);
	const { isValid, errors } = validate.searchQuery(sanitizedQuery);

	if (!isValid) {
		return res.status(400).json({
			message: "Bad request",
			errors
		});
	}

	try {
		console.log("query:", sanitizedQuery);
		const userFields = {
			_id: 1,
			username: 1,
			fullname: 1,
			email: 1,
			userImage: 1
		};
		const results = await Fiction.fuzzySearch(sanitizedQuery)
			.select({ body: 0 })
			.populate("userId", userFields);

		res.status(200).json({
			message: `Search results for ${q}`,
			results
		});
	} catch (err) {
		res.status(400).json({
			message: "Search failed",
			errors: {
				error: err
			}
		});
	}
}

module.exports = {
	createFiction,
	getFictions,
	getOneFiction,
	getFictionByCategory,
	getSearchResults
};
